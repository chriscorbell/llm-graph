import type { CSSProperties } from "react";
import antgroup from "@lobehub/icons-static-svg/icons/antgroup.svg";
import arcee from "@lobehub/icons-static-svg/icons/arcee.svg";
import claude from "@lobehub/icons-static-svg/icons/claude.svg";
import cohere from "@lobehub/icons-static-svg/icons/cohere.svg";
import deepseek from "@lobehub/icons-static-svg/icons/deepseek.svg";
import gemini from "@lobehub/icons-static-svg/icons/gemini.svg";
import ibm from "@lobehub/icons-static-svg/icons/ibm.svg";
import inception from "@lobehub/icons-static-svg/icons/inception.svg";
import kimi from "@lobehub/icons-static-svg/icons/kimi.svg";
import longcat from "@lobehub/icons-static-svg/icons/longcat.svg";
import meta from "@lobehub/icons-static-svg/icons/meta.svg";
import minimax from "@lobehub/icons-static-svg/icons/minimax.svg";
import mistral from "@lobehub/icons-static-svg/icons/mistral.svg";
import nvidia from "@lobehub/icons-static-svg/icons/nvidia.svg";
import openai from "@lobehub/icons-static-svg/icons/openai.svg";
import qwen from "@lobehub/icons-static-svg/icons/qwen.svg";
import stepfun from "@lobehub/icons-static-svg/icons/stepfun.svg";
import tencent from "@lobehub/icons-static-svg/icons/tencent.svg";
import upstage from "@lobehub/icons-static-svg/icons/upstage.svg";
import xai from "@lobehub/icons-static-svg/icons/xai.svg";
import xiaomimimo from "@lobehub/icons-static-svg/icons/xiaomimimo.svg";
import zai from "@lobehub/icons-static-svg/icons/zai.svg";

// Keyed by Artificial Analysis creator name, lowercased with non-alphanumerics removed.
// Where a lab's AI brand is the better-known mark (Claude, Gemini, Qwen, MiMo), that's used.
const LOGOS: Record<string, string> = {
  anthropic: claude,
  openai,
  google: gemini,
  meta,
  xai,
  spacexai: xai,
  alibaba: qwen,
  qwen,
  xiaomi: xiaomimimo,
  zai,
  zhipu: zai,
  stepfun,
  kimi,
  moonshotai: kimi,
  deepseek,
  mistral,
  nvidia,
  minimax,
  ibm,
  cohere,
  upstage,
  tencent,
  longcat,
  meituan: longcat,
  inclusionai: antgroup,
  inception,
  arceeai: arcee,
};

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A lab's logo tinted in its chart color; labs without a known logo get a plain dot. */
export function CreatorMark({ name, color, size = 16 }: { name: string; color: string; size?: number }) {
  const logo = LOGOS[key(name)];
  const style = { "--mark-color": color, "--mark-size": `${size}px` } as CSSProperties;
  if (!logo) return <span className="mark mark-dot" style={style} aria-hidden />;
  return (
    <span
      className="mark"
      style={{ ...style, "--mark-logo": `url("${logo}")` } as CSSProperties}
      aria-hidden
    />
  );
}
