import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Primary location of the user-uploaded JW Marriott Mumbai image
const PRIMARY_IMAGE_PATH =
  "C:\\Users\\satya\\.gemini\\antigravity-ide\\brain\\a19ddd2d-9098-4376-830f-5a748373c72b\\.user_uploaded\\media_1789803294216.jpg";

export async function GET() {
  try {
    const candidatePaths = [
      path.join(process.cwd(), "public", "jw-marriott-hero.jpg"),
      path.join(process.cwd(), "apps", "web", "public", "jw-marriott-hero.jpg"),
      PRIMARY_IMAGE_PATH,
    ];

    let foundBuffer: Buffer | null = null;

    for (const candidate of candidatePaths) {
      try {
        if (candidate && fs.existsSync(candidate)) {
          foundBuffer = fs.readFileSync(candidate);
          break;
        }
      } catch {
        // Continue to next candidate
      }
    }

    if (foundBuffer) {
      // Mirror to both potential public directories for static delivery
      const mirrorTargets = [
        path.join(process.cwd(), "public", "jw-marriott-hero.jpg"),
        path.join(process.cwd(), "apps", "web", "public", "jw-marriott-hero.jpg"),
      ];

      for (const target of mirrorTargets) {
        try {
          const targetDir = path.dirname(target);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          if (!fs.existsSync(target)) {
            fs.writeFileSync(target, foundBuffer);
          }
        } catch {
          // Ignore mirroring failure
        }
      }

      return new NextResponse(foundBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Elegant fallback SVG if image file is unavailable
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#14201a"/>
          <stop offset="50%" stop-color="#212b26"/>
          <stop offset="100%" stop-color="#2d4437"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#c59a2a" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#14201a" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect width="100%" height="100%" fill="url(#glow)"/>
      <text x="50%" y="45%" text-anchor="middle" font-family="serif" font-size="48" fill="#e1c269" font-weight="bold" letter-spacing="8">JW MARRIOTT MUMBAI</text>
      <text x="50%" y="52%" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#d7c5ae" letter-spacing="4">FLAGSHIP OPERATIONAL MODEL · VESPER 360</text>
    </svg>`;

    return new NextResponse(fallbackSvg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return new NextResponse(
      JSON.stringify({ error: "Failed to load resort hero image", details: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
