// App.jsx - Simple layout wrapper
import React from "react";
import Navbar from "./navbar";

export default function App({ children }) {
  return (
    <>
      <Navbar />
      <div className="lg:w-4/5 w-full lg:ml-auto">
        {children}
      </div>
    </>
  );
}
