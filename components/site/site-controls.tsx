"use client";

import type { Content } from "@/lib/model";
import { socialIcons } from "./social-icons";
import {
  MotionAnchor,
  MotionButton,
} from "./navigation";

const referenceSocials = {
  X: "https://x.com/zeudidipalma",
};

export function SocialLinks({
  content,
  className,
}: {
  content: Content;
  className: string;
}) {
  const links = [...content.social];

  if (
    !links.some(
      (social) =>
        social.label.toLowerCase() === "x",
    )
  ) {
    const twitchIndex =
      links.findIndex(
        (social) =>
          social.label.toLowerCase() ===
          "twitch",
      );

    links.splice(
      twitchIndex < 0
        ? links.length
        : twitchIndex,
      0,
      {
        label: "X",
        url: referenceSocials.X,
      },
    );
  }

  return (
    <nav
      className={className}
      aria-label="Social links"
    >
      {links.map((social) => (
        <MotionAnchor
          key={social.url}
          href={social.url}
          target="_blank"
          rel="noreferrer"
          aria-label={social.label}
          title={social.label}
        >
          {socialIcons[
            social.label
          ] ? (
            <span
              className="social-icon"
              aria-hidden="true"
              dangerouslySetInnerHTML={{
                __html:
                  socialIcons[
                    social.label
                  ],
              }}
            />
          ) : (
            <span
              className="social-icon-text"
              aria-hidden="true"
            >
              {social.label.slice(
                0,
                1,
              )}
            </span>
          )}
        </MotionAnchor>
      ))}
    </nav>
  );
}

export function BackButton({
  onBack,
  className,
}: {
  onBack: () => void;
  className: string;
}) {
  return (
    <MotionButton
      type="button"
      className={`${className} unified-back`}
      onClick={onBack}
      aria-label="Back to main page"
    >
      <span
        className="unified-back__arrow"
        aria-hidden="true"
      >
        ←
      </span>

      <span>BACK</span>
    </MotionButton>
  );
}
