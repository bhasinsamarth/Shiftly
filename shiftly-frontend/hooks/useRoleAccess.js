// hooks/useRoleAccess.js
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

// Hook to check if the current user has one of the specified roles
export const useRoleAccess = (allowedRoleIds = []) => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState(null);

  // Memoize the allowedRoleIds array to prevent unnecessary re-renders
  const memoizedAllowedRoleIds = useMemo(() => allowedRoleIds, [JSON.stringify(allowedRoleIds)]);

  useEffect(() => {
    const checkAccess = async () => {
      setIsLoading(true);
      
      if (!user) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch the employee record with role information
        const { data: employee, error } = await supabase
          .from('employee')
          .select('*, role:role_id(*)')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching employee role:', error);
          setHasAccess(false);
        } else if (employee) {
          setEmployeeData(employee);
          // Check if user's role_id is in the allowed roles
          const roleId = employee.role_id;
          setHasAccess(memoizedAllowedRoleIds.includes(roleId));
        } else {
          setHasAccess(false);
        }
      } catch (err) {
        console.error('Error in role access check:', err);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [user, memoizedAllowedRoleIds]);

  return { hasAccess, isLoading, employeeData };
};
