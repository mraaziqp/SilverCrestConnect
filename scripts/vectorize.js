import fs from 'fs';

// Let's write a script that accurately traces the lines:
// The logo has 2 isometric ribbon chevrons:
// Outer chevron 1:
// Top point: (228, 6)
// Left point: (4, 150)
// Bottom turn: (225, 275) -> horizontal to (80, 275)
//
// Let's inspect pixel brightness along the strokes to get 100% exact subpixel polygon vertices.
console.log('Vectorize utility ready');
