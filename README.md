# StaffEasy - Employee Management System

StaffEasy is a comprehensive employee management system designed to simplify operations within companies of any size. This web application centralizes employee data, eliminating outdated paper-based systems and disconnected spreadsheets.

## Project Contributors

- **Evan Di Placido**: Documentation & Frontend Development
- **Caleb Irvine**: Frontend Development
- **Nikita Kristenko**: Authentication & Database
- **Mohammed Moin Shaikh**: Backend Development

## Features

- **Employee Management**: Create, read, update, and delete employee records
- **Team Structure Management**: Organize teams and reporting hierarchies
- **Role-Based Access Control**: Different permissions for admins, managers, and employees
- **Time-Off Management**: Request and approve time off
- **Payroll Management**: Send paychecks and view payment history
- **Analytics Dashboard**: Visualize company and employee metrics

## Technology Stack

- **Frontend**: React.js with Tailwind CSS
- **Backend**: Node.js with Express
- **Database**: MongoDB (NoSQL)
- **Authentication**: NextAuth
- **State Management**: React Context API
- **Routing**: React Router
- **Charts**: Recharts for data visualization

## Getting Started

### Prerequisites

- Node.js (v14.x or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/moin-shk/PROJ-StaffEasy.git
   cd staffeasy
   ```

2. Install frontend dependencies:

   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:

   ```
   VITE_SUPABASE_URL=<Your Supabase URL>
   VITE_SUPABASE_ANON_KEY= <Your Anon Key>
   ```

4. Start the development server:

   ```
   npm start
   ```

5. In a separate terminal, start the backend server:

   ```
   cd server
   npm install
   npm start
   ```

6. Open [http://localhost:3000](http://localhost:3000) to view the application in your browser.

## Role-Based Access

- **Admin**: Full access to all features, including employee management, team structure, and analytics
- **Manager**: Access to time-off approval, paycheck management, and team metrics
- **Employee**: Access to personal profile, time-off requests, and paycheck information

---

Developed as part of Web Dev 2 course project - 2025
