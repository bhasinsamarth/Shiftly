// App.jsx - Simple layout wrapper
import React from "react";
import Navbar from "./navbar";

export default function App({ children }) {
  return (
    <>
      <Navbar />

      <div className="lg:w-5/6 w-full lg:ml-auto">

        {children}
      </div>
    </>
  );
}
