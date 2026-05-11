import {
  LuBookOpen,
  LuCircleHelp,
  LuCompass,
  LuDatabase,
  LuFileInput,
  LuGauge,
  LuPackage,
  LuRoute,
  LuSettings,
  LuShare2,
  LuTarget
} from "react-icons/lu";

export const documentationSections = [
  { id: "introduction", label: "Introduction", icon: LuBookOpen },
  { id: "quick-start", label: "Quick Start", icon: LuGauge },
  { id: "installation", label: "Installation", icon: LuPackage },
  { id: "supported-inputs", label: "Supported Inputs", icon: LuDatabase },
  { id: "loading-data", label: "Loading Data", icon: LuFileInput },
  { id: "navigating-viewer", label: "Navigating the Viewer", icon: LuCompass },
  { id: "key-features", label: "Key Features", icon: LuRoute },
  { id: "sharing", label: "File URLs and Sharing", icon: LuShare2 },
  { id: "environment", label: "Environment Variables", icon: LuSettings },
  { id: "troubleshooting", label: "Troubleshooting", icon: LuCircleHelp },
  { id: "usecases", label: "Use cases", icon: LuTarget }
];
