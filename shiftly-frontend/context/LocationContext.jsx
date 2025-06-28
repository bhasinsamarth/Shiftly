import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentLocation } from '../utils/locationService';

const LocationContext = createContext();

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (!context) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};

export const LocationProvider = ({ children }) => {
    const [currentLocation, setCurrentLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [locationPermission, setLocationPermission] = useState('prompt'); // 'granted', 'denied', 'prompt'

    // Check location permission status
    const checkLocationPermission = async () => {
        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                setLocationPermission(permission.state);
                
                permission.addEventListener('change', () => {
                    setLocationPermission(permission.state);
                });
            } catch (error) {
                console.warn('Could not check location permission:', error);
            }
        }
    };

    // Get current location
    const updateLocation = async () => {
        setIsLoadingLocation(true);
        setLocationError(null);
        
        try {
            const location = await getCurrentLocation();
            setCurrentLocation(location);
            setLocationError(null);
        } catch (error) {
            setLocationError(error.message);
            setCurrentLocation(null);
        } finally {
            setIsLoadingLocation(false);
        }
    };

    // Request location permission and get location
    const requestLocation = async () => {
        await updateLocation();
    };

    // Auto-update location every 5 minutes if permission is granted
    useEffect(() => {
        checkLocationPermission();
        
        if (locationPermission === 'granted') {
            updateLocation();
            
            const interval = setInterval(() => {
                updateLocation();
            }, 5 * 60 * 1000); // 5 minutes
            
            return () => clearInterval(interval);
        }
    }, [locationPermission]);

    const value = {
        currentLocation,
        locationError,
        isLoadingLocation,
        locationPermission,
        requestLocation,
        updateLocation,
        hasLocation: !!currentLocation
    };

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
};
