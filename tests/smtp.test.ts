/**
 * SMTP integration tests.
 *
 * These run against a real (if minimal) SMTP server on localhost rather than a
 * mock, so they exercise the actual nodemailer transport: connection, AUTH,
 * envelope, and MIME assembly. A mock would have happily passed while the real
 * transport rejected the message.
 *
 * The stub server speaks just enough SMTP to accept a message and records what
 * it received, so the assertions can check the wire content.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

import { createMailer, loadMailerConfig, describeMailer, bareAddress } from '../src/server/email/mailer.ts';
import { donationReceipt } from '../src/server/email/render.ts';

interface Captured {
  authenticated: boolean;
  mailFrom: string;
  rcptTo: string[];
  data: string;
}

/** Minimal SMTP responder. Returns the port and whatever it captured. */
function startStubSmtp(): Promise<{
  port: number;
  captured: Captured[];
  close: () => Promise<void>;
}> {
  const captured: Captured[] = [];

  const server = net.createServer((socket) => {
    let current: Captured = { authenticated: false, mailFrom: '', rcptTo: [], data: '' };
    let inData = false;
    let buffer = '';
    let awaitingAuthLine = false;

    socket.write('220 localhost ESMTP stub\r\n');

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      // In DATA mode everything is body until a lone dot on its own line.
      if (inData) {
        const terminator = buffer.indexOf('\r\n.\r\n');
        if (terminator === -1) return;
        current.data = buffer.slice(0, terminator);
        buffer = buffer.slice(terminator + 5);
        inData = false;
        captured.push(current);
        current = { authenticated: false, mailFrom: '', rcptTo: [], data: '' };
        socket.write('250 2.0.0 OK: queued\r\n');
      }

      let index: number;
      while ((index = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);

        // Continuation line of an AUTH LOGIN exchange.
        if (awaitingAuthLine) {
          awaitingAuthLine = false;
          current.authenticated = true;
          socket.write('235 2.7.0 Authentication successful\r\n');
          continue;
        }

        const upper = line.toUpperCase();

        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
          socket.write('250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        } else if (upper.startsWith('AUTH PLAIN')) {
          current.authenticated = true;
          socket.write('235 2.7.0 Authentication successful\r\n');
        } else if (upper.startsWith('AUTH LOGIN')) {
          awaitingAuthLine = true;
          socket.write('334 VXNlcm5hbWU6\r\n');
        } else if (upper.startsWith('MAIL FROM')) {
          current.mailFrom = line.slice(line.indexOf(':') + 1).trim();
          socket.write('250 2.1.0 OK\r\n');
        } else if (upper.startsWith('RCPT TO')) {
          current.rcptTo.push(line.slice(line.indexOf(':') + 1).trim());
          socket.write('250 2.1.5 OK\r\n');
        } else if (upper === 'DATA') {
          inData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          return;
        } else if (upper === 'QUIT') {
          socket.write('221 2.0.0 Bye\r\n');
          socket.end();
        } else if (upper === 'RSET') {
          socket.write('250 2.0.0 OK\r\n');
        } else {
          socket.write('250 2.0.0 OK\r\n');
        }
      }
    });

    socket.on('error', () => {
      /* client hangs up on pool teardown; not a test failure */
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      resolve({
        port,
        captured,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

function smtpEnv(port: number, overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(port),
    SMTP_USER: 'connect@scconnect.co.za',
    SMTP_PASS: 'app-password',
    // The stub speaks plaintext, so TLS is off for the test only.
    SMTP_REQUIRE_TLS: 'false',
    EMAIL_FROM: 'connect@scconnect.co.za',
    EMAIL_FROM_NAME: 'Silver Crest Connect',
    EMAIL_REPLY_TO: 'wesley@example.co.za',
    ...overrides,
  } as NodeJS.ProcessEnv;
}

test('SMTP_HOST selects the smtp driver over resend', () => {
  const mailer = createMailer(
    loadMailerConfig({ SMTP_HOST: 'smtp.office365.com', RESEND_API_KEY: 'x' } as NodeJS.ProcessEnv),
  );
  assert.equal(mailer.driver, 'smtp');
  assert.equal(mailer.configured, true);
  mailer.close?.();
});

test('port 587 uses STARTTLS, port 465 uses implicit TLS', () => {
  const starttls = loadMailerConfig({ SMTP_HOST: 'h', SMTP_PORT: '587' } as NodeJS.ProcessEnv);
  assert.equal(starttls.smtp?.secure, false);

  const implicit = loadMailerConfig({ SMTP_HOST: 'h', SMTP_PORT: '465' } as NodeJS.ProcessEnv);
  assert.equal(implicit.smtp?.secure, true);

  // An explicit override wins over the port-based guess.
  const forced = loadMailerConfig({
    SMTP_HOST: 'h',
    SMTP_PORT: '587',
    SMTP_SECURE: 'true',
  } as NodeJS.ProcessEnv);
  assert.equal(forced.smtp?.secure, true);
});

test('a message is actually delivered over SMTP with both MIME parts', async () => {
  const stub = await startStubSmtp();
  const config = loadMailerConfig(smtpEnv(stub.port));
  const mailer = createMailer(config);

  try {
    const result = await mailer.send(
      'nadia@tmroasters.co.za',
      donationReceipt({ name: 'Aisha Patel', amountZAR: 250, reference: 'DON-QQ1122' }),
    );

    assert.equal(result.ok, true, `send failed: ${result.error}`);
    assert.equal(stub.captured.length, 1, 'exactly one message should have been delivered');

    const message = stub.captured[0];
    assert.equal(message.authenticated, true, 'the transport must authenticate');
    assert.match(message.mailFrom, /connect@scconnect\.co\.za/);
    assert.deepEqual(message.rcptTo, ['<nadia@tmroasters.co.za>']);

    // Headers
    assert.match(message.data, /^From: Silver Crest Connect <connect@scconnect\.co\.za>$/m);
    assert.match(message.data, /^To: nadia@tmroasters\.co\.za$/m);
    assert.match(message.data, /^Reply-To: wesley@example\.co\.za$/m);
    // Subjects containing non-ASCII (the em dash) are RFC 2047 encoded-words,
    // so the literal amount is not present in the header. Assert the header
    // exists and is encoded correctly; subject content is covered in
    // email.test.ts against the renderer directly.
    assert.match(message.data, /^Subject: =\?UTF-8\?Q\?/m);

    // Both parts present, as multipart/alternative.
    assert.match(message.data, /multipart\/alternative/);
    assert.match(message.data, /Content-Type: text\/plain/);
    assert.match(message.data, /Content-Type: text\/html/);
  } finally {
    mailer.close?.();
    await stub.close();
  }
});

test('EMAIL_REDIRECT_TO diverts mail away from the real recipient', async () => {
  const stub = await startStubSmtp();
  const config = loadMailerConfig(
    smtpEnv(stub.port, { EMAIL_REDIRECT_TO: 'staging@example.co.za' }),
  );
  const mailer = createMailer(config);

  try {
    await mailer.send(
      'realapplicant@example.co.za',
      donationReceipt({ name: 'Test', amountZAR: 100, reference: 'DON-1' }),
    );

    assert.deepEqual(stub.captured[0].rcptTo, ['<staging@example.co.za>']);
    assert.doesNotMatch(
      stub.captured[0].data,
      /realapplicant@example\.co\.za/,
      'the real recipient must not appear anywhere in the message',
    );
  } finally {
    mailer.close?.();
    await stub.close();
  }
});

test('verify() succeeds against a reachable server', async () => {
  const stub = await startStubSmtp();
  const mailer = createMailer(loadMailerConfig(smtpEnv(stub.port)));

  try {
    const result = await mailer.verify?.();
    assert.equal(result?.ok, true, `verify failed: ${result?.error}`);
  } finally {
    mailer.close?.();
    await stub.close();
  }
});

test('an unreachable server fails with an actionable message, not a raw code', async () => {
  // Port 1 is reserved and nothing listens there.
  const mailer = createMailer(
    loadMailerConfig(smtpEnv(1, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1' })),
  );

  try {
    const result = await mailer.send(
      'someone@example.co.za',
      donationReceipt({ name: 'Test', amountZAR: 100, reference: 'DON-1' }),
    );
    assert.equal(result.ok, false);
    assert.match(String(result.error), /could not reach the SMTP server/);
  } finally {
    mailer.close?.();
  }
});

test('a From that differs from the authenticated mailbox is flagged', () => {
  const config = loadMailerConfig({
    SMTP_HOST: 'smtp.office365.com',
    SMTP_USER: 'wesley@silvercrestconsulting.co.za',
    SMTP_PASS: 'x',
    EMAIL_FROM: 'connect@scconnect.co.za',
  } as NodeJS.ProcessEnv);
  const mailer = createMailer(config);

  try {
    const described = describeMailer(mailer, config);
    // Microsoft 365 rejects this with 5.7.60 unless Send As is granted, so it
    // must be surfaced before someone discovers it via a bounced ticket.
    assert.ok(
      described.warnings.some((w) => w.includes('Send As')),
      'a From/SMTP_USER mismatch must warn',
    );
  } finally {
    mailer.close?.();
  }
});

test('matching From and SMTP_USER produces no mismatch warning', () => {
  const config = loadMailerConfig({
    SMTP_HOST: 'smtp.office365.com',
    SMTP_USER: 'connect@scconnect.co.za',
    SMTP_PASS: 'x',
    EMAIL_FROM: 'Silver Crest Connect <connect@scconnect.co.za>',
  } as NodeJS.ProcessEnv);
  const mailer = createMailer(config);

  try {
    const described = describeMailer(mailer, config);
    assert.equal(
      described.warnings.some((w) => w.includes('Send As')),
      false,
    );
  } finally {
    mailer.close?.();
  }
});

test('missing credentials are flagged rather than failing silently', () => {
  const config = loadMailerConfig({ SMTP_HOST: 'smtp.office365.com' } as NodeJS.ProcessEnv);
  const mailer = createMailer(config);

  try {
    const described = describeMailer(mailer, config);
    assert.ok(described.warnings.some((w) => w.includes('SMTP_USER or SMTP_PASS')));
  } finally {
    mailer.close?.();
  }
});

test('bareAddress strips the display name', () => {
  assert.equal(bareAddress('Silver Crest Connect <connect@scconnect.co.za>'), 'connect@scconnect.co.za');
  assert.equal(bareAddress('connect@scconnect.co.za'), 'connect@scconnect.co.za');
  assert.equal(bareAddress('  Mixed CASE <A@B.CO.ZA> '), 'a@b.co.za');
});
