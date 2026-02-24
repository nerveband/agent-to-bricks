import { Provider } from "jotai";
import { AppShell } from "./components/AppShell";

export default function App() {
  return (
    <Provider>
      <AppShell />
    </Provider>
  );
}
