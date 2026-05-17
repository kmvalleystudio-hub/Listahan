/**
 * Full-screen abstract outline backdrop — balanced decorative strokes (original art).
 */
export const USERNAME_WRITING_ART_VIEWBOX = "0 0 1000 780";

/** Stroke-only paths spread across the canvas. */
export const USERNAME_WRITING_ART_PATHS: readonly string[] = [
  // Soft frame arcs — corners
  "M 72 88 C 72 48 108 28 148 28 C 188 28 218 58 218 98",
  "M 928 88 C 928 48 892 28 852 28 C 812 28 782 58 782 98",
  "M 72 692 C 72 732 108 752 148 752 C 188 752 218 722 218 682",
  "M 928 692 C 928 732 892 752 852 752 C 812 752 782 722 782 682",

  // Large gentle rings (partial) — visual weight in quadrants
  "M 500 118 C 628 118 728 218 728 346 C 728 474 628 574 500 574",
  "M 500 206 C 398 206 318 286 318 388 C 318 490 398 570 500 570",
  "M 168 390 C 168 298 242 224 334 224 C 426 224 500 298 500 390",
  "M 832 390 C 832 482 758 556 666 556 C 574 556 500 482 500 390",

  // Flowing S-curves — vertical balance
  "M 118 160 C 198 220 198 340 118 400 C 38 460 38 580 118 640",
  "M 882 160 C 802 220 802 340 882 400 C 962 460 962 580 882 640",

  // Horizontal waves — tie left/right
  "M 40 278 C 180 248 320 308 460 278 C 600 248 740 308 880 278",
  "M 80 502 C 220 472 360 532 500 502 C 640 472 780 532 920 502",

  // Small accent circles — fill mid-field lightly
  "M 312 142 A 36 36 0 1 1 311.9 142",
  "M 688 142 A 36 36 0 1 1 687.9 142",
  "M 248 618 A 28 28 0 1 1 247.9 618",
  "M 752 618 A 28 28 0 1 1 751.9 618",
  "M 500 648 A 44 44 0 1 1 499.9 648",

  // Diagonal light cross-flow
  "M 200 120 L 420 340",
  "M 800 120 L 580 340",
  "M 200 660 L 420 440",
  "M 800 660 L 580 440",
];
