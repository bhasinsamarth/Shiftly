import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getCoordinatesFromAddress } from '../utils/locationService';
import { getTimezoneOffset } from '../utils/timezoneUtils';
import TimezoneDropdown from '../components/TimezoneDropdown';
import { EllipsisVertical } from 'lucide-react';

const BulkStoreGeocoding = () => {
    
    const [stores, setStores] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showResults, setShowResults] = useState(false);
    const [showGeocodeModal, setShowGeocodeModal] = useState(false);

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedStore, setSelectedStore] = useState(null);
    const [editedStore, setEditedStore] = useState({});
    const [saving, setSaving] = useState(false);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false); // Moved here

    // Close country dropdown when modal closes
    useEffect(() => {
        if (!showEditModal) setShowCountryDropdown(false);
    }, [showEditModal]); // Now valid!

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
            console.error('Error parsing store coordinates:', store.coordinates);
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
                .select('store_id, store_name, address_line_1, address_line_2, city, province, postal_code, country, coordinates, status, timezone')
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
        setShowGeocodeModal(false);
        setProcessing(true);
        setResults([]);
        setShowResults(true);

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

                // Throttle requests to avoid hitting API limits
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1100));
                }

                const coordinates = await getCoordinatesFromAddress(fullAddress);
                if (coordinates) {
                    const coordinatesJson = JSON.stringify({
                        latitude: coordinates.latitude,
                        longitude: coordinates.longitude
                    });

                    const { error: updateError } = await supabase
                        .from('store')
                        .update({ coordinates: coordinatesJson })
                        .eq('store_id', store.store_id);

                    if (updateError) throw updateError;

                    geocodingResults.push({
                        id: store.store_id,
                        name: store.store_name,
                        address: fullAddress,
                        status: 'success',
                        coordinates,
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
        await fetchStores();
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
                    .update({ coordinates: coordinatesJson })
                    .eq('store_id', store.store_id);

                if (error) throw error;

                alert(`Successfully geocoded ${store.store_name}!
                Latitude: ${coordinates.latitude.toFixed(6)}
                Longitude: ${coordinates.longitude.toFixed(6)}`);
                await fetchStores();
            } else {
                alert(`Failed to geocode ${store.store_name}. Please check the address.`);
            }
        } catch (error) {
            console.error('Error geocoding store:', error);
            alert(`Error geocoding ${store.store_name}: ${error.message}`);
        }
    };

    // Open edit modal with selected store
    const handleOpenEdit = (store) => {
        setSelectedStore(store);
        setEditedStore({ ...store });
        setShowEditModal(true);
    };

    // Save edited store
    const handleSaveStore = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const { error } = await supabase
                .from('store')
                .update(editedStore)
                .eq('store_id', selectedStore.store_id);

            if (error) throw error;

            alert('Store updated successfully!');
            setShowEditModal(false);
            await fetchStores(); // Refresh list
        } catch (err) {
            console.error('Error updating store:', err);
            alert('Failed to update store.');
        } finally {
            setSaving(false);
        }
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
        <div className="min-h-screen p-3 sm:p-4 lg:p-6">
            <div className="max-w-full mx-auto relative">
                {/* Header */}
                <div className="mb-6 sm:mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Stores</h1>
                    </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
                    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 text-center">
                        <h3 className="text-sm sm:text-lg font-semibold text-gray-800 mb-1 sm:mb-2">Total Stores</h3>
                        <p className="text-xl sm:text-3xl font-bold text-blue-600">{stores.length}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 text-center">
                        <h3 className="text-sm sm:text-lg font-semibold text-gray-800 mb-1 sm:mb-2">With Coordinates</h3>
                        <p className="text-xl sm:text-3xl font-bold text-green-600">
                            {stores.length - storesWithoutCoordinates.length}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 text-center">
                        <h3 className="text-sm sm:text-lg font-semibold text-gray-800 mb-1 sm:mb-2">Missing Coordinates</h3>
                        <p className="text-xl sm:text-3xl font-bold text-red-600">
                            {storesWithoutCoordinates.length}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 text-center">
                        <h3 className="text-sm sm:text-lg font-semibold text-gray-800 mb-1 sm:mb-2">No Address</h3>
                        <p className="text-xl sm:text-3xl font-bold text-yellow-600">
                            {storesWithoutAddress.length}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6 sm:mb-8">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">Actions</h2>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pb-4">
                        <button
                            onClick={() => setShowGeocodeModal(true)}
                            disabled={processing || storesWithoutCoordinates.length === 0}
                            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base"
                        >
                            {processing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    <span className="hidden sm:inline">Geocoding... ({progress.current}/{progress.total})</span>
                                    <span className="sm:hidden">Geocoding...</span>
                                </>
                            ) : (
                                <span className="text-center">
                                    <span className="hidden sm:inline">Geocode All Missing ({storesWithoutCoordinates.length} stores)</span>
                                    <span className="sm:hidden">Geocode All ({storesWithoutCoordinates.length})</span>
                                </span>
                            )}
                        </button>
                        <button
                            onClick={fetchStores}
                            disabled={processing}
                            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 text-sm sm:text-base"
                        >
                            Refresh List
                        </button>
                    </div>

                    {/* Modal for geocoding confirmation */}
                    {showGeocodeModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
                            <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 max-w-md w-full mx-4">
                                <h3 className="text-lg font-semibold mb-4">Bulk Geocode All Stores?</h3>
                                <p className="mb-6 text-gray-700 text-sm sm:text-base">This will geocode all stores without coordinates. Are you sure you want to continue?</p>
                                <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                                    <button
                                        className="w-full sm:w-auto px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 text-sm sm:text-base"
                                        onClick={() => setShowGeocodeModal(false)}
                                        disabled={processing}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="w-full sm:w-auto px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm sm:text-base"
                                        onClick={geocodeAllStores}
                                        disabled={processing}
                                    >
                                        Yes, Geocode All
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Important Notes */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
                        <h3 className="font-medium text-yellow-800 mb-2 text-sm sm:text-base">⚠️ Important Notes</h3>
                        <ul className="text-xs sm:text-sm text-yellow-700 space-y-1">
                            <li>• Geocoding may take some time for too many stores</li>
                            <li>• Ensure store addresses are complete and accurate for best results</li>
                        </ul>
                    </div>
                </div>

                {/* Store List */}
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">All Stores</h2>
                        <button
                            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 shadow font-semibold border border-gray-200 text-sm sm:text-base"
                            onClick={() => {
                                setSelectedStore(null);
                                setEditedStore({
                                    store_name: '',
                                    address_line_1: '',
                                    address_line_2: '',
                                    city: '',
                                    province: '',
                                    postal_code: '',
                                    country: '',
                                    timezone: '',
                                    status: 'Active',
                                });
                                setShowEditModal('add');
                            }}
                        >
                            Add store
                        </button>
                    </div>

                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <div className="inline-block min-w-full align-middle">
                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                                <table className="min-w-full table-auto">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">Store name</th>
                                            <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 hidden md:table-cell">Address</th>
                                            <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 hidden sm:table-cell">Timezone</th>
                                            <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 hidden sm:table-cell">Coordinates</th>
                                            <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">Status</th>
                                            <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {stores.map((store) => {
                                            const coords = getStoreCoordinates(store);
                                            const fullAddress = buildStoreAddress(store);
                                            const rowBg = store.status === 'Inactive' ? 'bg-gray-50' : 'bg-white';

                                            return (
                                                <tr key={store.store_id} className={`${rowBg}`}>
                                                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-900 font-medium align-middle">
                                                        <div className="min-w-0">
                                                            <div className="truncate font-semibold">{store.store_name}</div>
                                                            {/* Show address on mobile when address column is hidden */}
                                                            <div className="md:hidden text-xs text-gray-500 truncate mt-1">
                                                                {fullAddress || 'No address'}
                                                            </div>
                                                            {/* Show timezone and coordinates info on mobile when those columns are hidden */}
                                                            <div className="sm:hidden text-xs text-gray-400 mt-1 space-y-1">
                                                                {store.timezone && (
                                                                    <div className="truncate">TZ: {store.timezone}</div>
                                                                )}
                                                                {coords && (
                                                                    <div className="truncate">📍 {coords.latitude.toFixed(2)}°, {coords.longitude.toFixed(2)}°</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-700 align-middle hidden md:table-cell">
                                                        <div className="max-w-xs truncate">
                                                            {fullAddress || <span className="text-gray-400">No address</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-700 align-middle hidden sm:table-cell">
                                                        {store.timezone ? (
                                                            <div className="truncate">
                                                                <span className="block md:hidden">{store.timezone}</span>
                                                                <span className="hidden md:block">{store.timezone}</span>
                                                                <span className="hidden lg:block text-xs text-gray-500">({getTimezoneOffset(store.timezone)})</span>
                                                            </div>
                                                        ) : <span className="text-gray-400">Not set</span>}
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-700 align-middle hidden sm:table-cell">
                                                        {coords ? (
                                                            <div className="truncate">
                                                                <span className="block md:hidden">📍 Set</span>
                                                                <span className="hidden md:block">{coords.latitude.toFixed(4)}°, {coords.longitude.toFixed(4)}°</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400">Not set</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm align-middle">
                                                        {(() => {
                                                            const status = store.status ? store.status.toLowerCase() : '';
                                                            let colorClass = 'bg-gray-100 text-gray-900';
                                                            if (status === 'inactive') colorClass = 'bg-gray-100 text-gray-500';
                                                            else if (status === 'suspended') colorClass = 'bg-yellow-100 text-yellow-800';
                                                            else if (status === 'active') colorClass = 'bg-green-100 text-green-800';
                                                            const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
                                                            return (
                                                                <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
                                                                    <span className="block sm:hidden">{(displayStatus || 'Unknown').charAt(0)}</span>
                                                                    <span className="hidden sm:block">{displayStatus || 'Unknown'}</span>
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm align-middle relative">
                                                        <KebabMenuUI store={store} onEdit={handleOpenEdit} onGeocode={geocodeSingleStore} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                {showResults && results.length > 0 && (
                    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mt-6 sm:mt-8">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Geocoding Results</h2>
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                            <div className="inline-block min-w-full align-middle">
                                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                                    <table className="min-w-full table-auto">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">Store</th>
                                                <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 hidden md:table-cell">Address</th>
                                                <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">Status</th>
                                                <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 hidden sm:table-cell">Coordinates</th>
                                                <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 hidden lg:table-cell">Error</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {results.map((result) => (
                                                <tr key={result.id} className="hover:bg-gray-50">
                                                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-900 font-medium">
                                                        <div className="min-w-0">
                                                            <div className="truncate">{result.name}</div>
                                                            {/* Show address on mobile */}
                                                            <div className="lg:hidden text-xs text-gray-500 truncate mt-1">
                                                                {result.address}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-900 hidden md:table-cell">
                                                        <div className="max-w-xs truncate">{result.address}</div>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                            result.status === 'success' 
                                                                ? 'bg-green-100 text-green-800' 
                                                                : 'bg-red-100 text-red-800'
                                                        }`}>
                                                            {result.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-900 hidden sm:table-cell">
                                                        {result.coordinates ? (
                                                            <div className="truncate">
                                                                <span className="hidden lg:inline">
                                                                    {`${result.coordinates.latitude.toFixed(6)}, ${result.coordinates.longitude.toFixed(6)}`}
                                                                </span>
                                                                <span className="lg:hidden">Set</span>
                                                            </div>
                                                        ) : (
                                                            'N/A'
                                                        )}
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-red-600 hidden lg:table-cell">
                                                        <div className="max-w-xs truncate">
                                                            {result.error || ''}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit/Add Store Modal */}
                {showEditModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
                        <div className="bg-white rounded-lg shadow-lg p-0 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
                            <div className="p-4 sm:p-6 border-b flex items-center justify-between">
                                <h3 className="text-lg font-semibold">{showEditModal === 'add' ? 'Add Store' : 'Edit Store'}</h3>
                                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                            </div>
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    setSaving(true);
                                    try {
                                        let storeToSave = {
                                            ...editedStore,
                                            status: editedStore.status || undefined,
                                        };
                                        if (showEditModal === 'add') {
                                            const addressParts = [
                                                storeToSave.address_line_1,
                                                storeToSave.address_line_2,
                                                storeToSave.city,
                                                storeToSave.province,
                                                storeToSave.postal_code,
                                                storeToSave.country
                                            ].filter(part => part && part.trim());
                                            const fullAddress = addressParts.join(', ');
                                            let coordinatesJson = null;
                                            if (fullAddress) {
                                                const coordinates = await getCoordinatesFromAddress(fullAddress);
                                                if (coordinates) {
                                                    coordinatesJson = JSON.stringify({
                                                        latitude: coordinates.latitude,
                                                        longitude: coordinates.longitude
                                                    });
                                                    storeToSave = { ...storeToSave, coordinates: coordinatesJson };
                                                }
                                            }
                                            const { error } = await supabase
                                                .from('store')
                                                .insert([storeToSave]);
                                            if (error) throw error;
                                            alert('Store added successfully!' + (coordinatesJson ? '\nCoordinates set.' : '\nNo coordinates (address incomplete or not found).'));
                                        } else {
                                            const { error } = await supabase
                                                .from('store')
                                                .update(storeToSave)
                                                .eq('store_id', selectedStore.store_id);
                                            if (error) throw error;
                                            alert('Store updated successfully!');
                                        }
                                        setShowEditModal(false);
                                        await fetchStores();
                                    } catch (err) {
                                        console.error('Error saving store:', err);
                                        alert('Failed to save store.');
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                                className="overflow-y-auto p-4 sm:p-6 flex-1"
                            >
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Store Name</label>
                                        <input
                                            type="text"
                                            value={editedStore.store_name || ''}
                                            onChange={(e) => setEditedStore({ ...editedStore, store_name: e.target.value })}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
                                        <input
                                            type="text"
                                            value={editedStore.address_line_1 || ''}
                                            onChange={(e) => setEditedStore({ ...editedStore, address_line_1: e.target.value })}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
                                        <input
                                            type="text"
                                            value={editedStore.address_line_2 || ''}
                                            onChange={(e) => setEditedStore({ ...editedStore, address_line_2: e.target.value })}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">City</label>
                                            <input
                                                type="text"
                                                value={editedStore.city || ''}
                                                onChange={(e) => setEditedStore({ ...editedStore, city: e.target.value })}
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Province</label>
                                            <input
                                                type="text"
                                                value={editedStore.province || ''}
                                                onChange={(e) => setEditedStore({ ...editedStore, province: e.target.value })}
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Postal Code</label>
                                            <input
                                                type="text"
                                                value={editedStore.postal_code || ''}
                                                onChange={(e) => setEditedStore({ ...editedStore, postal_code: e.target.value })}
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Country</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={editedStore.country || ''}
                                                    onChange={e => setEditedStore({ ...editedStore, country: e.target.value })}
                                                    onFocus={e => setShowCountryDropdown(true)}
                                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                                                    autoComplete="off"
                                                />
                                                {showCountryDropdown && (
                                                    <ul className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded shadow max-h-40 overflow-y-auto mt-1">
                                                        <li
                                                            className="px-4 py-2 hover:bg-blue-100 cursor-pointer text-sm sm:text-base"
                                                            onMouseDown={() => {
                                                                setEditedStore({ ...editedStore, country: 'Canada' });
                                                                setShowCountryDropdown(false);
                                                            }}
                                                        >
                                                            Canada
                                                        </li>
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Timezone</label>
                                            <div className="mt-1">
                                                <TimezoneDropdown
                                                    value={editedStore.timezone || ''}
                                                    onChange={(e) => setEditedStore({ ...editedStore, timezone: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Status</label>
                                            <select
                                                value={editedStore.status || 'Active'}
                                                onChange={(e) => setEditedStore({ ...editedStore, status: e.target.value })}
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Inactive">Inactive</option>
                                                <option value="Suspended">Suspended</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        disabled={saving}
                                        className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm sm:text-base"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm sm:text-base"
                                    >
                                        {saving ? (showEditModal === 'add' ? 'Adding...' : 'Saving...') : (showEditModal === 'add' ? 'Add Store' : 'Save Changes')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Kebab Menu Component
function KebabMenuUI({ store, onEdit, onGeocode }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative inline-block text-left">
            <button
                className="p-2 rounded-full hover:bg-gray-100 focus:outline-none"
                onClick={() => setOpen((v) => !v)}
                aria-label="Actions"
            >
                <EllipsisVertical className="w-5 h-5 text-gray-600" />
            </button>
            {open && (
                <div className="absolute right-0 mt-2 min-w-[8rem] rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 flex flex-col divide-y divide-gray-100">
                    <button
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => onEdit(store)}
                    >
                        Edit
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => onGeocode(store)}
                    >
                        Geocode
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                        Delete
                    </button>
                </div>
            )}
        </div>
    );
}

export default BulkStoreGeocoding;