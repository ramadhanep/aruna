import {
  Axe,
  Droplets,
  Magnet,
  MessageCircleMore,
  Rotate3D,
  Workflow,
} from "lucide-react";

export const TOOLS_ITEMS = [
  { title: "Money Flow", url: "/money-flow", icon: Workflow, desc: "Track institutional flow" },
  { title: "Momentum", url: "/idx-momentum", icon: Axe, desc: "IDX momentum scanner" },
  { title: "Bubbles", url: "/idx-bubbles", icon: Droplets, desc: "Market bubble map" },
  { title: "Rotation", url: "/idx-rotation", icon: Rotate3D, desc: "Sector rotation view" },
  { title: "MSCI", url: "/msci", icon: Magnet, desc: "MSCI rebalance tracker" },
  { title: "Chat", url: "/discussion", icon: MessageCircleMore, desc: "Community discussion" },
];
