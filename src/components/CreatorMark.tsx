import type { CSSProperties } from "react";
import antgroup from "@lobehub/icons-static-svg/icons/antgroup-color.svg";
import arcee from "@lobehub/icons-static-svg/icons/arcee-color.svg";
import claude from "@lobehub/icons-static-svg/icons/claude-color.svg";
import cohere from "@lobehub/icons-static-svg/icons/cohere-color.svg";
import deepseek from "@lobehub/icons-static-svg/icons/deepseek-color.svg";
import gemini from "@lobehub/icons-static-svg/icons/gemini-color.svg";
import ibm from "@lobehub/icons-static-svg/icons/ibm.svg";
import inception from "@lobehub/icons-static-svg/icons/inception.svg";
import kimi from "@lobehub/icons-static-svg/icons/kimi-color.svg";
import longcat from "@lobehub/icons-static-svg/icons/longcat-color.svg";
import meta from "@lobehub/icons-static-svg/icons/meta-color.svg";
import minimax from "@lobehub/icons-static-svg/icons/minimax-color.svg";
import mistral from "@lobehub/icons-static-svg/icons/mistral-color.svg";
import nvidia from "@lobehub/icons-static-svg/icons/nvidia-color.svg";
import openai from "@lobehub/icons-static-svg/icons/openai.svg";
import qwen from "@lobehub/icons-static-svg/icons/qwen-color.svg";
import stepfun from "@lobehub/icons-static-svg/icons/stepfun-color.svg";
import tencent from "@lobehub/icons-static-svg/icons/tencent-color.svg";
import upstage from "@lobehub/icons-static-svg/icons/upstage-color.svg";
import xai from "@lobehub/icons-static-svg/icons/xai.svg";
import zai from "@lobehub/icons-static-svg/icons/zai.svg";
import xiaomi from "simple-icons/icons/xiaomi.svg";

// Keyed by Artificial Analysis creator name, lowercased with non-alphanumerics removed.
// Where a lab's AI brand is the better-known mark (Claude, Gemini, Qwen), that's used.
// Brand-color logos render as-is. Single-color logos are drawn in `tint`: the brand color when
// it has one, otherwise the text color (how those brands appear on dark backgrounds).
const TEXT = "var(--text)";
const LOGOS: Record<string, { src: string; tint?: string }> = {
  anthropic: { src: claude },
  openai: { src: openai, tint: TEXT },
  google: { src: gemini },
  meta: { src: meta },
  xai: { src: xai, tint: TEXT },
  spacexai: { src: xai, tint: TEXT },
  alibaba: { src: qwen },
  qwen: { src: qwen },
  xiaomi: { src: xiaomi, tint: "#ff6900" },
  zai: { src: zai, tint: TEXT },
  zhipu: { src: zai, tint: TEXT },
  stepfun: { src: stepfun },
  kimi: { src: kimi },
  moonshotai: { src: kimi },
  deepseek: { src: deepseek },
  mistral: { src: mistral },
  nvidia: { src: nvidia },
  minimax: { src: minimax },
  ibm: { src: ibm, tint: TEXT },
  cohere: { src: cohere },
  upstage: { src: upstage },
  tencent: { src: tencent },
  longcat: { src: longcat },
  meituan: { src: longcat },
  inclusionai: { src: antgroup },
  inception: { src: inception, tint: TEXT },
  arceeai: { src: arcee },
};

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A lab's logo in its own colors; labs without a known logo get a dot in their chart color. */
export function CreatorMark({ name, color, size = 16 }: { name: string; color: string; size?: number }) {
  const logo = LOGOS[key(name)];
  const sizeStyle = { "--mark-size": `${size}px` } as CSSProperties;
  if (!logo) return <span className="mark mark-dot" style={{ ...sizeStyle, "--mark-color": color } as CSSProperties} aria-hidden />;
  if (logo.tint) {
    const style = { ...sizeStyle, "--mark-logo": `url("${logo.src}")`, "--mark-color": logo.tint } as CSSProperties;
    return <span className="mark" style={style} aria-hidden />;
  }
  return <img className="mark-img" src={logo.src} width={size} height={size} alt="" style={sizeStyle} />;
}
