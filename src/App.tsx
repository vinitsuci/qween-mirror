import QweenMirror from "./components/QweenMirror";
import RawCamera from "./components/RawCamera";

function App() {
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/raw")
  ) {
    return <RawCamera />;
  }
  return <QweenMirror />;
}

export default App;
