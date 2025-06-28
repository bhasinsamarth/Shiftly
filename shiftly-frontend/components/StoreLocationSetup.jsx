import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getCoordinatesFromAddress } from '../utils/locationService';

const StoreLocationSetup = ({ storeId, storeName, currentAddress, onLocationUpdated }) => {
    const [address, setAddress] = useState(currentAddress || '');
    const [coordinates, setCoordinates] = useState(null);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [message, setMessage] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        // Check if store already has coordinates
        checkExistingCoordinates();
    }, [storeId]);

    const checkExistingCoordinates = async () => {
        try {
            const { data, error } = await supabase
                .from('stores')
                .select('latitude, longitude, address')
                .eq('id', storeId)
                .single();

            if (error) throw error;

            if (data.latitude && data.longitude) {
                setCoordinates({
                    latitude: data.latitude,
                    longitude: data.longitude
                });
            }

            if (data.address) {
                setAddress(data.address);
            }
        } catch (error) {
            console.error('Error checking existing coordinates:', error);
        }
    };

    const handleGeocodeAddress = async () => {
        if (!address.trim()) {
            setMessage('Please enter a valid address');
            return;
        }

        setIsGeocoding(true);
        setMessage('');

        try {
            const coords = await getCoordinatesFromAddress(address);
            
            if (coords) {
                setCoordinates(coords);
                setMessage(`✅ Found coordinates: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
            } else {
                setMessage('❌ Could not find coordinates for this address. Please check the address and try again.');
                setCoordinates(null);
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            setMessage('❌ Error occurred while geocoding address');
            setCoordinates(null);
        } finally {
            setIsGeocoding(false);
        }
    };

    const handleSaveLocation = async () => {
        if (!coordinates) {
            setMessage('Please geocode the address first');
            return;
        }

        setIsUpdating(true);
        try {
            const { error } = await supabase
                .from('stores')
                .update({
                    address: address,
                    latitude: coordinates.latitude,
                    longitude: coordinates.longitude
                })
                .eq('id', storeId);

            if (error) throw error;

            setMessage('✅ Store location updated successfully!');
            
            if (onLocationUpdated) {
                onLocationUpdated(coordinates);
            }
        } catch (error) {
            console.error('Error updating store location:', error);
            setMessage('❌ Failed to update store location');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Store Location Setup - {storeName}
            </h2>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Store Address
                    </label>
                    <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Enter full store address (e.g., 123 Main St, City, Province, Country)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <button
                    onClick={handleGeocodeAddress}
                    disabled={isGeocoding || !address.trim()}
                    className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGeocoding ? 'Finding Location...' : 'Find Coordinates'}
                </button>

                {coordinates && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-4">
                        <h3 className="font-medium text-green-800 mb-2">Coordinates Found:</h3>
                        <p className="text-sm text-green-700">
                            Latitude: {coordinates.latitude.toFixed(6)}
                        </p>
                        <p className="text-sm text-green-700">
                            Longitude: {coordinates.longitude.toFixed(6)}
                        </p>
                        <p className="text-xs text-green-600 mt-2">
                            These coordinates will be used to validate employee clock in/out locations.
                            Employees must be within 50 meters of this location to clock in or out.
                        </p>
                    </div>
                )}

                {coordinates && (
                    <button
                        onClick={handleSaveLocation}
                        disabled={isUpdating}
                        className="w-full py-2 px-4 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUpdating ? 'Saving...' : 'Save Store Location'}
                    </button>
                )}

                {message && (
                    <div className={`p-3 rounded-md text-sm ${
                        message.includes('✅') 
                            ? 'bg-green-50 text-green-700 border border-green-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                        {message}
                    </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h3 className="font-medium text-blue-800 mb-2">📍 Location-Based Clock In/Out</h3>
                    <p className="text-sm text-blue-700">
                        Once you set up the store location, employees will be able to clock in and out 
                        using their mobile devices, but only when they are within 50 meters of the store.
                        This ensures accurate time tracking and prevents remote clock ins.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StoreLocationSetup;
