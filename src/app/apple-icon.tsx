import { ImageResponse } from "next/og";

// iOS ignores SVG icons for the home screen, so render the mark as a PNG.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#222122" }}>
        <svg width="92" height="114" viewBox="0 0 158 195" fill="#fff">
          <path fillRule="evenodd" d="M0 0H147V98Q148 107 158 108V143H0ZM37 36H107Q98 90 37 105Z" />
          <rect y="158" width="147" height="37" />
        </svg>
      </div>
    ),
    size,
  );
}
