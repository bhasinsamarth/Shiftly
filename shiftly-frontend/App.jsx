// App.jsx - Simple layout wrapper
import React from "react";
import Navbar from "./navbar";

export default function App({ children }) {
  return (
    <div className="mt-10 pt-4">
      <Navbar />

      <div className="lg:w-5/6 md:w-4/5 sm:3/4 w-full lg:ml-auto">

        {children}
      </div>
    </div>
  );
}
