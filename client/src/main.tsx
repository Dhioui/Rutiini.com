import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { initializeLiveUpdater } from "./lib/liveUpdater";
import { initializePushNotifications } from "./lib/pushNotifications";

initializeLiveUpdater();
initializePushNotifications();

createRoot(document.getElementById("root")!).render(<App />);
