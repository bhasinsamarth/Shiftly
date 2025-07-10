import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { getCoordinatesFromAddress } from '../utils/locationService';
import { COMMON_TIMEZONES, formatDateTime, getCurrentLocalTime, getTimezoneOffset } from '../utils/timezoneUtils';
import TimezoneDropdown from '../components/TimezoneDropdown';

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
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4 relative">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Stores</h1>
                        <p className="text-gray-600 mt-2">
                            One-time utility to add coordinates to all stores in your database
                        </p>
                    </div>
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
                    <div className="flex flex-wrap gap-4 pb-4">
                        <button
                            onClick={() => setShowGeocodeModal(true)}
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
                    </div>

                    {/* Modal for geocoding confirmation */}
                    {showGeocodeModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
                                <h3 className="text-lg font-semibold mb-4">Bulk Geocode All Stores?</h3>
                                <p className="mb-6 text-gray-700">This will geocode all stores without coordinates. Are you sure you want to continue?</p>
                                <div className="flex justify-end gap-4">
                                    <button
                                        className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                                        onClick={() => setShowGeocodeModal(false)}
                                        disabled={processing}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
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
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                        <h3 className="font-medium text-yellow-800 mb-2">⚠️ Important Notes</h3>
                        <ul className="text-sm text-yellow-700 space-y-1">
                            <li>• Geocoding may take some time for too many stores</li>
                            <li>• Ensure store addresses are complete and accurate for best results</li>
                        </ul>
                    </div>
                </div>

                {/* Store List */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">All Stores</h2>
                        <button
                            className="px-6 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 shadow font-semibold border border-gray-200"
                            style={{ minWidth: 120 }}
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

                    <div className="overflow-x-auto">
                        <table className="w-full table-auto">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Store name</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-56 max-w-xs">Address</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Timezone</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Coordinates</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stores.map((store) => {
                                    const coords = getStoreCoordinates(store);
                                    const fullAddress = buildStoreAddress(store);
                                    const rowBg = store.status === 'Inactive' ? 'bg-gray-50' : 'bg-white';

                                    return (
                                        <tr key={store.store_id} className={`${rowBg} border-b last:border-b-0`}>
                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium align-middle whitespace-nowrap">
                                                {store.store_name}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 align-middle whitespace-nowrap max-w-xs truncate">
                                                {fullAddress || <span className="text-gray-400">No address</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 align-middle whitespace-nowrap">
                                                {store.timezone ? (
                                                    <>
                                                        {store.timezone} <span className="text-xs text-gray-500">({getTimezoneOffset(store.timezone)})</span>
                                                    </>
                                                ) : <span className="text-gray-400">Not set</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 align-middle whitespace-nowrap">
                                                {coords ? (
                                                    <span>{coords.latitude.toFixed(4)}° N, {coords.longitude.toFixed(4)}° W</span>
                                                ) : (
                                                    <span className="text-gray-400">Not set</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm align-middle whitespace-nowrap">
                                                {(() => {
                                                    const status = store.status ? store.status.toLowerCase() : '';
                                                    let colorClass = 'bg-gray-100 text-gray-900';
                                                    if (status === 'inactive') colorClass = 'bg-gray-100 text-gray-500';
                                                    else if (status === 'suspended') colorClass = 'bg-yellow-100 text-yellow-800';
                                                    else if (status === 'active') colorClass = 'bg-green-100 text-green-800';
                                                    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
                                                    return (
                                                        <span className={`inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
                                                            {displayStatus || 'Unknown'}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-3 text-sm align-middle whitespace-nowrap relative">
                                                <KebabMenuUI store={store} onEdit={handleOpenEdit} onGeocode={geocodeSingleStore} />
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

                {/* Edit/Add Store Modal */}
                {showEditModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                        <div className="bg-white rounded-lg shadow-lg p-0 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
                            <div className="p-6 border-b flex items-center justify-between">
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
                                className="overflow-y-auto p-6 flex-1"
                            >
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Store Name</label>
                                        <input
                                            type="text"
                                            value={editedStore.store_name || ''}
                                            onChange={(e) => setEditedStore({ ...editedStore, store_name: e.target.value })}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
                                        <input
                                            type="text"
                                            value={editedStore.address_line_1 || ''}
                                            onChange={(e) => setEditedStore({ ...editedStore, address_line_1: e.target.value })}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
                                        <input
                                            type="text"
                                            value={editedStore.address_line_2 || ''}
                                            onChange={(e) => setEditedStore({ ...editedStore, address_line_2: e.target.value })}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">City</label>
                                            <input
                                                type="text"
                                                value={editedStore.city || ''}
                                                onChange={(e) => setEditedStore({ ...editedStore, city: e.target.value })}
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Province</label>
                                            <input
                                                type="text"
                                                value={editedStore.province || ''}
                                                onChange={(e) => setEditedStore({ ...editedStore, province: e.target.value })}
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Postal Code</label>
                                            <input
                                                type="text"
                                                value={editedStore.postal_code || ''}
                                                onChange={(e) => setEditedStore({ ...editedStore, postal_code: e.target.value })}
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                                    autoComplete="off"
                                                />
                                                {showCountryDropdown && (
                                                    <ul className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded shadow max-h-40 overflow-y-auto mt-1">
                                                        <li
                                                            className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
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
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Inactive">Inactive</option>
                                                <option value="Suspended">Suspended</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        disabled={saving}
                                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className="text-gray-600">
                    <circle cx="10" cy="4" r="1.5" />
                    <circle cx="10" cy="10" r="1.5" />
                    <circle cx="10" cy="16" r="1.5" />
                </svg>
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