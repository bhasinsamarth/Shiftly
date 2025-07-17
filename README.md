# Shiftly - Employee Management System

Shiftly is an employee management system designed to simplify operations within companies of any size. This web application centralizes employee data, eliminating outdated paper-based systems and disconnected spreadsheets.

## Features

- **Employee Management**: Create, read, update, and delete employee records
- **Team Structure Management**: Organize teams and reporting hierarchies
- **Role-Based Access Control**: Different permissions for admins, managers, and employees
- **Time-Off Management**: Request and approve time off
- **Payroll Management**: Send paychecks and view payment history
- **Analytics Dashboard**: Visualize company and employee metrics

## Technology Stack

- **Frontend**: Vite + React JS with Tailwind CSS
- **Backend**: Supabase
- **Database**: Supabase
- **Storage**: Supabase Storage
- **Authentication**: Supa Auth
- **Routing**: React Router

## Getting Started

### Prerequisites

- Node.js (v14.x or higher)
- npm package manager

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/bhasinsamarth/Shiftly/
   cd Shiftly
   ```

2. Install necessary dependencies:

   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:

   ```
   VITE_SUPABASE_URL=<Your Supabase URL>
   VITE_SUPABASE_ANON_KEY= <Your Anon Key>
   ```

4. Run the application:

   ```
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173) to view the application in your browser.


