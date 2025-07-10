import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { getCoordinatesFromAddress } from '../utils/locationService';

const BulkStoreGeocoding = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    // Only allow admin (role_id === 1) or owner (role_id === 2)
    useEffect(() => {
        if (!isAuthenticated) return; // Let global route guard handle unauthenticated
        if (!user || (user.role_id !== 1 && user.role_id !== 2)) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, isAuthenticated, navigate]);
    const [stores, setStores] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showResults, setShowResults] = useState(false);

    // Helper function to build full address from store data
    const buildStoreAddress = (store) => {
        const parts = [
            store.address_line_1,
            store.address_line_2,
            store.city,
            store.province,
            store.postal_code,
            store.country
        ].filter(part => part && part.trim());
        
        return parts.join(', ');
    };

    // Helper function to check if store has coordinates
    const hasCoordinates = (store) => {
        if (!store.coordinates) return false;
        try {
            const coords = JSON.parse(store.coordinates);
            return coords.latitude && coords.longitude;
        } catch {
            return false;
        }
    };

    // Helper function to get coordinates from store
    const getStoreCoordinates = (store) => {
        try {
            if (store.coordinates) {
                return JSON.parse(store.coordinates);
            }
        } catch {
            // Invalid JSON
        }
        return null;
    };

    useEffect(() => {
        fetchStores();
    }, []);

    const fetchStores = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('store')
                .select('store_id, store_name, address_line_1, address_line_2, city, province, postal_code, country, coordinates')
                .order('store_name');

            if (error) throw error;
            setStores(data || []);
        } catch (error) {
            console.error('Error fetching stores:', error);
            alert('Failed to fetch stores. Please check your database connection.');
        } finally {
            setIsLoading(false);
        }
    };

    const geocodeAllStores = async () => {
        if (!window.confirm('This will geocode all stores without coordinates. Are you sure you want to continue?')) {
            return;
        }

        setProcessing(true);
        setResults([]);
        setShowResults(true);
        
        // Filter stores that don't have coordinates or have incomplete coordinates
        const storesToGeocode = stores.filter(store => {
            if (!store.coordinates) return true;
            try {
                const coords = JSON.parse(store.coordinates);
                return !coords.latitude || !coords.longitude;
            } catch {
                return true;
            }
        });

        setProgress({ current: 0, total: storesToGeocode.length });

        const geocodingResults = [];
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < storesToGeocode.length; i++) {
            const store = storesToGeocode[i];
            setProgress({ current: i + 1, total: storesToGeocode.length });

            try {
                console.log(`Geocoding store ${i + 1}/${storesToGeocode.length}: ${store.store_name}`);
                
                const fullAddress = buildStoreAddress(store);
                if (!fullAddress) {
                    geocodingResults.push({
                        id: store.store_id,
                        name: store.store_name,
                        address: fullAddress,
                        status: 'error',
                        error: 'No address provided',
                        coordinates: null
                    });
                    failureCount++;
                    continue;
                }

                // Add delay to respect API rate limits (Nominatim allows 1 request per second)
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1100)); // 1.1 second delay
                }

                const coordinates = await getCoordinatesFromAddress(fullAddress);

                if (coordinates) {
                    // Update the store in the database with JSON coordinates
                    const coordinatesJson = JSON.stringify({
                        latitude: coordinates.latitude,
                        longitude: coordinates.longitude
                    });
                    
                    const { error: updateError } = await supabase
                        .from('store')
                        .update({
                            coordinates: coordinatesJson
                        })
                        .eq('store_id', store.store_id);

                    if (updateError) {
                        throw updateError;
                    }

                    geocodingResults.push({
                        id: store.store_id,
                        name: store.store_name,
                        address: fullAddress,
                        status: 'success',
                        coordinates: coordinates,
                        error: null
                    });
                    successCount++;
                } else {
                    geocodingResults.push({
                        id: store.store_id,
                        name: store.store_name,
                        address: fullAddress,
                        status: 'error',
                        error: 'Could not geocode address',
                        coordinates: null
                    });
                    failureCount++;
                }
            } catch (error) {
                console.error(`Error geocoding store ${store.store_name}:`, error);
                geocodingResults.push({
                    id: store.store_id,
                    name: store.store_name,
                    address: buildStoreAddress(store),
                    status: 'error',
                    error: error.message,
                    coordinates: null
                });
                failureCount++;
            }
        }

        setResults(geocodingResults);
        setProcessing(false);

        // Refresh stores list to show updated coordinates
        await fetchStores();

        alert(`Geocoding completed!\nSuccess: ${successCount}\nFailed: ${failureCount}\nTotal: ${storesToGeocode.length}`);
    };

    const geocodeSingleStore = async (store) => {
        const fullAddress = buildStoreAddress(store);
        if (!fullAddress) {
            alert('This store has no address to geocode.');
            return;
        }

        try {
            const coordinates = await getCoordinatesFromAddress(fullAddress);
            
            if (coordinates) {
                const coordinatesJson = JSON.stringify({
                    latitude: coordinates.latitude,
                    longitude: coordinates.longitude
                });
                
                const { error } = await supabase
                    .from('store')
                    .update({
                        coordinates: coordinatesJson
                    })
                    .eq('store_id', store.store_id);

                if (error) throw error;
                
                alert(`Successfully geocoded ${store.store_name}!\nLatitude: ${coordinates.latitude.toFixed(6)}\nLongitude: ${coordinates.longitude.toFixed(6)}`);
                await fetchStores();
            } else {
                alert(`Failed to geocode ${store.store_name}. Please check the address.`);
            }
        } catch (error) {
            console.error('Error geocoding store:', error);
            alert(`Error geocoding ${store.store_name}: ${error.message}`);
        }
    };

    const exportResults = () => {
        if (results.length === 0) return;

        const csvContent = [
            ['Store ID', 'Store Name', 'Address', 'Status', 'Latitude', 'Longitude', 'Error'],
            ...results.map(result => [
                result.id,
                result.name,
                result.address,
                result.status,
                result.coordinates?.latitude || '',
                result.coordinates?.longitude || '',
                result.error || ''
            ])
        ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `store_geocoding_results_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading stores...</p>
                </div>
            </div>
        );
    }

    const storesWithoutCoordinates = stores.filter(store => {
        if (!store.coordinates) return true;
        try {
            const coords = JSON.parse(store.coordinates);
            return !coords.latitude || !coords.longitude;
        } catch {
            return true;
        }
    });

    const storesWithoutAddress = stores.filter(store => 
        !store.address_line_1 || store.address_line_1.trim() === ''
    );

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Bulk Store Geocoding</h1>
                    <p className="text-gray-600 mt-2">
                        One-time utility to add coordinates to all stores in your database
                    </p>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Stores</h3>
                        <p className="text-3xl font-bold text-blue-600">{stores.length}</p>
                    </div>
                    
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">With Coordinates</h3>
                        <p className="text-3xl font-bold text-green-600">
                            {stores.length - storesWithoutCoordinates.length}
                        </p>
                    </div>
                    
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Missing Coordinates</h3>
                        <p className="text-3xl font-bold text-red-600">
                            {storesWithoutCoordinates.length}
                        </p>
                    </div>
                    
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Address</h3>
                        <p className="text-3xl font-bold text-yellow-600">
                            {storesWithoutAddress.length}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Actions</h2>
                    
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={geocodeAllStores}
                            disabled={processing || storesWithoutCoordinates.length === 0}
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {processing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Geocoding... ({progress.current}/{progress.total})
                                </>
                            ) : (
                                `Geocode All Missing (${storesWithoutCoordinates.length} stores)`
                            )}
                        </button>

                        <button
                            onClick={fetchStores}
                            disabled={processing}
                            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
                        >
                            Refresh List
                        </button>

                        {results.length > 0 && (
                            <button
                                onClick={exportResults}
                                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
                            >
                                Export Results CSV
                            </button>
                        )}
                    </div>

                    {processing && (
                        <div className="mt-4">
                            <div className="bg-gray-200 rounded-full h-2">
                                <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                ></div>
                            </div>
                            <p className="text-sm text-gray-600 mt-2">
                                Processing {progress.current} of {progress.total} stores...
                            </p>
                        </div>
                    )}
                </div>

                {/* Important Notes */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                    <h3 className="font-medium text-yellow-800 mb-2">⚠️ Important Notes</h3>
                    <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• This tool respects Nominatim API rate limits (1 request per second)</li>
                        <li>• Geocoding may take several minutes for many stores</li>
                        <li>• Ensure store addresses are complete and accurate for best results</li>
                        <li>• This is a one-time operation - coordinates will be saved to the database</li>
                        <li>• Failed geocoding attempts can be retried individually</li>
                    </ul>
                </div>

                {/* Store List */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">All Stores</h2>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full table-auto">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Store Name</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Address</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Coordinates</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {stores.map((store) => {
                                    const coords = getStoreCoordinates(store);
                                    const fullAddress = buildStoreAddress(store);
                                    
                                    return (
                                        <tr key={store.store_id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                {store.store_name}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {fullAddress || 'No address'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {coords ? (
                                                    <span className="text-green-600">
                                                        {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                                                    </span>
                                                ) : (
                                                    <span className="text-red-600">Not set</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {!fullAddress ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                        No Address
                                                    </span>
                                                ) : coords ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        Complete
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                        Missing Coordinates
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {fullAddress && !coords && (
                                                    <button
                                                        onClick={() => geocodeSingleStore(store)}
                                                        disabled={processing}
                                                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                                    >
                                                        Geocode
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Results Section */}
                {showResults && results.length > 0 && (
                    <div className="bg-white rounded-lg shadow-md p-6 mt-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Geocoding Results</h2>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full table-auto">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Store</th>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Address</th>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Coordinates</th>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Error</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {results.map((result) => (
                                        <tr key={result.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                {result.name}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {result.address}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                    result.status === 'success' 
                                                        ? 'bg-green-100 text-green-800' 
                                                        : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {result.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {result.coordinates ? (
                                                    `${result.coordinates.latitude.toFixed(6)}, ${result.coordinates.longitude.toFixed(6)}`
                                                ) : (
                                                    'N/A'
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-red-600">
                                                {result.error || ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkStoreGeocoding;
