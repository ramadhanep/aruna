import {
  Axe,
  Droplets,
  Magnet,
  MessageCircleMore,
  Rotate3D,
  Workflow,
} from "lucide-react";

const MONEY_FLOW_ENABLED = process.env.NEXT_PUBLIC_MONEY_FLOW_ENABLED !== "false";

export const TOOLS_ITEMS = [
  { title: "Bubbles", url: "/idx-bubbles", icon: Droplets, desc: "Market bubble map" },
  { title: "MSCI", url: "/msci", icon: Magnet, desc: "MSCI rebalance tracker" },
  { title: "Momentum", url: "/idx-momentum", icon: Axe, desc: "IDX momentum scanner" },
  { title: "Rotation", url: "/idx-rotation", icon: Rotate3D, desc: "Stock rotation view" },
  ...(MONEY_FLOW_ENABLED
    ? [{ title: "Money Flow", url: "/money-flow", icon: Workflow, desc: "Track institutional flow" }]
    : []),
  { title: "Chat", url: "/discussion", icon: MessageCircleMore, desc: "Community discussion" },
];
