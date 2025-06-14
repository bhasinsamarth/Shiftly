// App.jsx - Simple layout wrapper
import React from "react";
import Navbar from "./navbar";

export default function App({ children }) {
  return (
    <>
      <Navbar />
      <div className="mt-16 p-4">{children}</div>
    </>
  );
}
