
  import { createRoot } from "react-dom/client";
  import { AuthProvider } from "./app/AuthProvider";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import DesktopAuthCatcher from "./app/DesktopAuthCatcher";

  const root = createRoot(document.getElementById("root")!);

  if (window.location.pathname === "/desktop-login") {
    root.render(<DesktopAuthCatcher />);
  } else {
    root.render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );
  }