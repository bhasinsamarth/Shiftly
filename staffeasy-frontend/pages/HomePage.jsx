import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const HomePage = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <section className="text-center py-10 md:py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
          Welcome to StaffEasy
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
          A comprehensive employee management system designed to simplify operations 
          within companies of any size.
        </p>
        {!isAuthenticated ? (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-md text-lg transition-colors"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="bg-white hover:bg-gray-100 text-blue-600 font-semibold py-3 px-6 rounded-md text-lg border border-blue-600 transition-colors"
            >
              Log In
            </Link>
          </div>
        ) : (
          <Link
            to="/dashboard"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-md text-lg transition-colors"
          >
            Go to Dashboard
          </Link>
        )}
      </section>

      {/* Features Section */}
      <section className="py-12 bg-gray-50 rounded-xl my-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Key Features</h2>
          <p className="text-gray-600">Everything you need to manage your team effectively</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 px-4">
          <FeatureCard
            title="Employee Management"
            description="Create, update, and track employee information in one central location."
            icon="👥"
          />
          <FeatureCard
            title="Time-Off Management"
            description="Streamline vacation requests and approvals with automated workflows."
            icon="📅"
          />
          <FeatureCard
            title="Team Structure"
            description="Organize and visualize your company's reporting structure."
            icon="🏢"
          />
          <FeatureCard
            title="Role-Based Access"
            description="Control who sees what with customizable permission levels."
            icon="🔒"
          />
        </div>
      </section>

      {/* User Type Section */}
      <section className="py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Built For Everyone</h2>
          <p className="text-gray-600">Tailored features for different roles in your organization</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 px-4">
          <UserTypeCard
            userType="Administrators"
            features={[
              "Manage employee information",
              "Organize team structure",
              "Assign roles to employees"
            ]}
            bgColor="bg-blue-50"
            textColor="text-blue-700"
            borderColor="border-blue-200"
          />
          <UserTypeCard
            userType="Managers"
            features={[
              "Approve time-off requests",
              "Monitor attendance",
              "Manage team performance"
            ]}
            bgColor="bg-green-50"
            textColor="text-green-700"
            borderColor="border-green-200"
          />
          <UserTypeCard
            userType="Employees"
            features={[
              "Submit time-off requests",
              "Request position changes"
            ]}
            bgColor="bg-purple-50"
            textColor="text-purple-700"
            borderColor="border-purple-200"
          />
        </div>
      </section>

      {/* Call To Action */}
      <section className="py-12 text-center bg-gradient-to-r from-blue-500 to-blue-700 rounded-xl text-white my-10">
        <h2 className="text-3xl font-bold mb-4">Ready to Simplify Your Employee Management?</h2>
        <p className="text-xl mb-8 max-w-3xl mx-auto">
          Join hundreds of companies already using StaffEasy to streamline their operations.
        </p>
        {!isAuthenticated ? (
          <Link
            to="/register"
            className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-md text-lg transition-colors"
          >
            Get Started Today
          </Link>
        ) : (
          <Link
            to="/dashboard"
            className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-md text-lg transition-colors"
          >
            Go to Dashboard
          </Link>
        )}
      </section>
    </div>
  );
};

// Helper Components
const FeatureCard = ({ title, description, icon }) => (
  <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 text-center hover:shadow-lg transition-shadow">
    <div className="text-4xl mb-4">{icon}</div>
    <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

const UserTypeCard = ({ userType, features, bgColor, textColor, borderColor }) => (
  <div className={`${bgColor} p-6 rounded-lg border ${borderColor}`}>
    <h3 className={`text-xl font-semibold ${textColor} mb-4`}>{userType}</h3>
    <ul className="space-y-2">
      {features.map((feature, index) => (
        <li key={index} className="flex items-start">
          <span className={`${textColor} mr-2`}>✓</span>
          <span className="text-gray-700">{feature}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default HomePage;
