import {
  LuBookOpen,
  LuDatabase,
  LuFileInput,
  LuGauge,
  LuPackage,
  LuRoute,
  LuShare2,
  LuTarget
} from "react-icons/lu";

export const documentationSections = [
  { id: "introduction", label: "Introduction", icon: LuBookOpen },
  { id: "quick-start", label: "Quick Start", icon: LuGauge },
  { id: "installation", label: "Installation", icon: LuPackage },
  { id: "supported-inputs", label: "Supported Inputs", icon: LuDatabase },
  { id: "loading-data", label: "Loading & Navigation", icon: LuFileInput },
  { id: "key-features", label: "Key Features", icon: LuRoute },
  { id: "sharing", label: "File URLs and Sharing", icon: LuShare2 },
  { id: "usecases", label: "Use cases", icon: LuTarget }
];
