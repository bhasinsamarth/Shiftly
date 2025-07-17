// App.jsx - Simple layout wrapper
import React from "react";
import Navbar from "./navbar";

export default function App({ children }) {
  return (

    <div className="min-h-screen">
      <Navbar />

      {/* Main content area with proper responsive spacing */}
      <div className="pt-16 lg:ml-64 transition-all duration-300">
        <div className="">
          {children}
        </div>

      </div>
    </div>
  );
}
