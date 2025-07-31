// Location service utilities for clock in/out functionality

/**
 * Get coordinates for an address using Nominatim API
 * @param {string} address - The address to geocode
 * @returns {Promise<{latitude: number, longitude: number} | null>}
 */
export const getCoordinatesFromAddress = async (address) => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon)
            };
        }
        return null;
    } catch (error) {
        console.error('Error geocoding address:', error);
        return null;
    }
};

/**
 * Get user's current location using HTML5 Geolocation API
 * @returns {Promise<{latitude: number, longitude: number} | null>}
 */
export const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                let errorMessage = 'Unknown location error';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied by user';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out';
                        break;
                }
                reject(new Error(errorMessage));
            },
            options
        );
    });
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

/**
 * Check if user is within allowed radius of store location
 * @param {object} userLocation - User's current location {latitude, longitude}
 * @param {object} storeLocation - Store location {latitude, longitude}
 * @param {number} allowedRadius - Allowed radius in meters (default: 50)
 * @returns {boolean} True if within radius, false otherwise
 */
export const isWithinRadius = (userLocation, storeLocation, allowedRadius) => {
    const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        storeLocation.latitude,
        storeLocation.longitude
    );
    
    return distance <= allowedRadius;
};

/**
 * Format distance for display
 * @param {number} distance - Distance in meters
 * @returns {string} Formatted distance string
 */
export const formatDistance = (distance) => {
    if (distance < 1000) {
        return `${Math.round(distance)}m`;
    } else {
        return `${(distance / 1000).toFixed(1)}km`;
    }
};

/**
 * Calculate total hours worked from time log data
 * @param {Array} timeLogs - Array of time log entries
 * @returns {object} Object with totalHours, breakTime, and workTime
 */
export const calculateHoursFromTimeLogs = (timeLogs) => {
    if (!Array.isArray(timeLogs) || timeLogs.length === 0) {
        return { totalHours: 0, breakTime: 0, workTime: 0 };
    }

    // Sort logs chronologically
    const sortedLogs = [...timeLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let clockInTime = null;
    let clockOutTime = null;
    let totalBreakTime = 0;
    let currentBreakStart = null;

    sortedLogs.forEach(log => {
        switch (log.type) {
            case 'clock_in':
                clockInTime = new Date(log.timestamp);
                break;
            case 'clock_out':
                clockOutTime = new Date(log.timestamp);
                break;
            case 'break_start':
                currentBreakStart = new Date(log.timestamp);
                break;
            case 'break_end':
                if (currentBreakStart) {
                    totalBreakTime += (new Date(log.timestamp) - currentBreakStart) / (1000 * 60 * 60); // Convert to hours
                    currentBreakStart = null;
                }
                break;
        }
    });

    // Calculate total time and work time
    let totalHours = 0;
    let workTime = 0;

    if (clockInTime && clockOutTime) {
        totalHours = (clockOutTime - clockInTime) / (1000 * 60 * 60); // Convert to hours
        workTime = Math.max(0, totalHours - totalBreakTime);
    }

    return {
        totalHours: Math.round(totalHours * 100) / 100,
        breakTime: Math.round(totalBreakTime * 100) / 100,
        workTime: Math.round(workTime * 100) / 100
    };
};

/**
 * Get current status from time logs
 * @param {Array} timeLogs - Array of time log entries
 * @returns {object} Object with status and last event info
 */
export const getCurrentStatusFromTimeLogs = (timeLogs) => {
    if (!Array.isArray(timeLogs) || timeLogs.length === 0) {
        return { status: 'clocked_out', lastEvent: null, isClockedIn: false, isOnBreak: false };
    }

    // Sort logs chronologically
    const sortedLogs = [...timeLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let isClockedIn = false;
    let isOnBreak = false;
    let lastEvent = sortedLogs[sortedLogs.length - 1];

    // Check for active clock in
    const hasActiveClock = sortedLogs.some(log => 
        log.type === 'clock_in' && 
        !sortedLogs.find(outLog => 
            outLog.type === 'clock_out' && 
            new Date(outLog.timestamp) > new Date(log.timestamp)
        )
    );

    // Check for active break
    const hasActiveBreak = sortedLogs.some(log => 
        log.type === 'break_start' && 
        !sortedLogs.find(endLog => 
            endLog.type === 'break_end' && 
            new Date(endLog.timestamp) > new Date(log.timestamp)
        )
    );

    isClockedIn = hasActiveClock;
    isOnBreak = hasActiveBreak;

    let status = 'clocked_out';
    if (isClockedIn) {
        status = isOnBreak ? 'on_break' : 'clocked_in';
    }

    return {
        status,
        lastEvent,
        isClockedIn,
        isOnBreak
    };
};

/**
 * Format time duration for display
 * @param {number} hours - Hours as decimal number
 * @returns {string} Formatted time string (e.g., "8h 30m")
 */
export const formatDuration = (hours) => {
    if (hours === 0) return '0m';
    
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};
