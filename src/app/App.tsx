import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./providers/AuthProvider";
import { SoleyVoltAssistant } from "./components/SoleyVoltAssistant";
import { Toaster } from "sonner";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton />
      <SoleyVoltAssistant />
    </AuthProvider>
  );
}
