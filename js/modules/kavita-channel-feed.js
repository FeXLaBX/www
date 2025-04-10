// kavita-channel-feed.js - UPDATED
// Module for displaying YouTube channels in the Kavita section

import { EventBus } from './event-bus.js';
import { ErrorRecovery } from './error-recovery.js';
import { LoadingIndicator } from './loading-indicators.js';

// Configuration for YouTube channel feed
const channelFeedConfig = {
    // Sample channels - will be replaced with config from yt-config.json
    channels: [],
    
    // YouTube API key (will be loaded from config)
    apiKey: '',
    
    // Container ID
    containerId: 'kavita-channel-feed',
    
    // Animation durations
    animationDuration: 800, // ms
    
    // Modal ID
    modalId: 'kavita-channel-modal'
};

// Initialize the channel feed module
export function initializeChannelFeed() {
    console.log("Initializing Kavita Channel Feed...");
    
    // Load API key from config
    loadAPIKey();
    
    // Create the channel feed container if it doesn't exist
    createChannelFeedContainer();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load channel data from yt-config.json
    loadChannelConfig()
        .then(() => {
            // After config is loaded, load channel data (thumbnails, titles)
            return loadChannelData();
        })
        .catch(error => {
            console.error("Error initializing channel feed:", error);
            // Load with default data anyway
            loadChannelData();
        });
    
    // Make the API globally available
    window.KavitaChannelFeed = {
        show: showChannelFeed,
        hide: hideChannelFeed,
        openChannel: openChannelModal
    };
    
    return {
        show: showChannelFeed,
        hide: hideChannelFeed,
        openChannel: openChannelModal
    };
}

// Load the YouTube API key from the config file
async function loadAPIKey() {
    try {
        // Try to load from the existing config first
        if (window.configState && window.configState.youtubeApiKey) {
            channelFeedConfig.apiKey = window.configState.youtubeApiKey;
            return;
        }
        
        // Try to get from the TMDB API if available (it might have loaded the key)
        if (window.TMDBAPI && window.TMDBAPI.youtubeApiKey) {
            channelFeedConfig.apiKey = window.TMDBAPI.youtubeApiKey;
            return;
        }
        
        // Otherwise try to load from api-config.json
        const response = await fetch('/api/api-config.json');
        if (response.ok) {
            const config = await response.json();
            if (config.externalApis && config.externalApis.youtube && config.externalApis.youtube.apiKey) {
                channelFeedConfig.apiKey = config.externalApis.youtube.apiKey;
                console.log("Loaded YouTube API key from config");
            } else {
                console.warn("No YouTube API key found in config");
            }
        } else {
            console.error("Failed to load api-config.json");
        }
    } catch (error) {
        console.error("Error loading YouTube API key:", error);
    }
}

// NEW: Load channel configuration from yt-config.json
async function loadChannelConfig() {
    try {
        // Try multiple paths to find the config
        const configPaths = [
            '/youtube/yt-config.json',
            '/yt-config.json',
            'youtube/yt-config.json',
            'yt-config.json'
        ];
        
        let config = null;
        
        // Try each path until we find a valid config
        for (const path of configPaths) {
            try {
                console.log(`Trying to load yt-config.json from ${path}`);
                const response = await fetch(path);
                if (response.ok) {
                    config = await response.json();
                    console.log(`Successfully loaded yt-config.json from ${path}`);
                    break;
                }
            } catch (e) {
                console.warn(`Failed to load from ${path}:`, e.message);
            }
        }
        
        if (!config) {
            throw new Error("Could not load yt-config.json from any path");
        }
        
        // Extract kavita configuration
        if (config.kavita) {
            // Check if we have a channels array
            if (config.kavita.channels && Array.isArray(config.kavita.channels)) {
                channelFeedConfig.channels = config.kavita.channels;
                console.log(`Loaded ${channelFeedConfig.channels.length} channels from yt-config.json`);
            } else {
                // If no channels array, use the main channel info
                channelFeedConfig.channels = [{
                    id: config.kavita.channelId,
                    name: config.kavita.channelName || "Comic Book Channel"
                }];
                console.log("Using single channel from yt-config.json");
            }
            
            // Store other config settings
            channelFeedConfig.maxResults = config.kavita.maxResults || 10;
            channelFeedConfig.fallbackVideos = config.kavita.fallbackVideos || [];
        } else {
            throw new Error("No Kavita configuration found in yt-config.json");
        }
        
        return true;
    } catch (error) {
        console.error("Error loading channel configuration:", error);
        
        // Set up default channels if config loading fails
        channelFeedConfig.channels = [
            {
                id: 'UCLE0YuDRMprbHMfbvJYZpMw',
                name: 'Raph Retro Comics'
            },
            {
                id: 'UCDOkxRiVpdv6bYqrSa4TZlA',
                name: 'Dope Comix'
            }
        ];
        
        console.log("Using default channels due to config loading error");
        return false;
    }
}

// Create the channel feed container
function createChannelFeedContainer() {
    // Check if container already exists
    let container = document.getElementById(channelFeedConfig.containerId);
    if (container) return;
    
    // Create container
    container = document.createElement('div');
    container.id = channelFeedConfig.containerId;
    container.className = 'kavita-channel-feed';
    
    // Add title
    const title = document.createElement('div');
    title.className = 'kavita-channel-feed-title';
    title.textContent = 'Featured Comic Book Channels';
    container.appendChild(title);
    
    // Create channel list
    const channelList = document.createElement('div');
    channelList.className = 'kavita-channel-list';
    container.appendChild(channelList);
    
    // Add to body
    document.body.appendChild(container);
    
    // Add loading state initially
    channelList.innerHTML = `
        <div class="kavita-channel-loading">
            <div class="loading-spinner"></div>
            <div>Loading channels...</div>
        </div>
    `;
    
    console.log("Created Kavita channel feed container");
}

// Set up event listeners
function setupEventListeners() {
    // Listen for app selection events
    EventBus.on(EventBus.Events.APP_SELECTED, (event) => {
        const appName = event.detail?.appName;
        if (appName === 'kavita') {
            console.log("Kavita selected, showing channel feed");
            
            // Wait for animations to start
            setTimeout(() => {
                showChannelFeed();
            }, 300); // Short delay
        } else if (channelFeedConfig.isVisible) {
            // Hide if another app is selected
            hideChannelFeed();
        }
    });
    
    // Listen for app closed events
    EventBus.on(EventBus.Events.APP_CLOSED, () => {
        if (channelFeedConfig.isVisible) {
            hideChannelFeed();
        }
    });
    
    // Create modal container
    createChannelModal();
    
    console.log("Channel feed event listeners set up");
}

// Create the channel modal container
function createChannelModal() {
    // Check if modal already exists
    let modal = document.getElementById(channelFeedConfig.modalId);
    if (modal) return;
    
    // Create modal container
    modal = document.createElement('div');
    modal.id = channelFeedConfig.modalId;
    modal.className = 'kavita-channel-modal';
    
    // Create modal content
    modal.innerHTML = `
        <div class="kavita-modal-content">
            <div class="kavita-modal-header">
                <button class="kavita-modal-close">&times;</button>
                <h3 class="kavita-modal-title">Channel Name</h3>
            </div>
            <div class="kavita-modal-body">
                <div class="kavita-channel-info">
                    <div class="kavita-channel-thumbnail">
                        <img src="" alt="Channel thumbnail">
                    </div>
                    <div class="kavita-channel-details">
                        <div class="kavita-channel-description"></div>
                        <div class="kavita-channel-stats">
                            <div class="kavita-channel-subscribers"></div>
                            <div class="kavita-channel-videos"></div>
                        </div>
                    </div>
                </div>
                <div class="kavita-video-player">
                    <div class="kavita-video-container"></div>
                </div>
                <div class="kavita-channel-videos-list"></div>
            </div>
        </div>
    `;
    
    // Add close button functionality
    modal.querySelector('.kavita-modal-close').addEventListener('click', () => {
        closeChannelModal();
    });
    
    // Add to body
    document.body.appendChild(modal);
    
    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeChannelModal();
        }
    });
    
    // Add escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('visible')) {
            closeChannelModal();
        }
    });
    
    console.log("Created Kavita channel modal");
}

// Show the channel feed
function showChannelFeed() {
    const container = document.getElementById(channelFeedConfig.containerId);
    if (!container) return;
    
    // Mark as visible
    channelFeedConfig.isVisible = true;
    
    // Show container
    container.style.display = 'block';
    
    // Force a reflow
    void container.offsetWidth;
    
    // Add visible class to trigger animation
    container.classList.add('visible');
    
    console.log("Showing Kavita channel feed");
}

// Hide the channel feed
function hideChannelFeed() {
    const container = document.getElementById(channelFeedConfig.containerId);
    if (!container) return;
    
    // Remove visible class to trigger animation
    container.classList.remove('visible');
    
    // Mark as not visible
    channelFeedConfig.isVisible = false;
    
    // Actually hide after animation completes
    setTimeout(() => {
        if (!channelFeedConfig.isVisible) {
            container.style.display = 'none';
        }
    }, channelFeedConfig.animationDuration);
    
    console.log("Hiding Kavita channel feed");
}

// Load channel data from YouTube API
async function loadChannelData() {
    const channelList = document.querySelector('.kavita-channel-list');
    if (!channelList) return;
    
    try {
        // Make sure we have channels
        if (!channelFeedConfig.channels || channelFeedConfig.channels.length === 0) {
            console.warn("No channels configured, loading default channels");
            channelFeedConfig.channels = [
                {
                    id: 'UCLE0YuDRMprbHMfbvJYZpMw',
                    name: 'Raph Retro Comics'
                },
                {
                    id: 'UCDOkxRiVpdv6bYqrSa4TZlA',
                    name: 'Dope Comix'
                }
            ];
        }
        
        // Show loading state
        LoadingIndicator.startLoading('kavitaChannels', 'Loading YouTube channels...');
        
        // Start building the channel list HTML
        let channelsHTML = '';
        
        // Process each channel - with batching for better performance
        const batchSize = 3; // Process channels in batches of 3
        const batches = [];
        
        // Divide channels into batches
        for (let i = 0; i < channelFeedConfig.channels.length; i += batchSize) {
            batches.push(channelFeedConfig.channels.slice(i, i + batchSize));
        }
        
        // Process batches sequentially
        for (const batch of batches) {
            // Process channels in this batch in parallel
            const batchResults = await Promise.all(
                batch.map(channel => fetchChannelInfo(channel))
            );
            
            // Add HTML for each channel
            batchResults.forEach(result => {
                if (result.success) {
                    channelsHTML += result.html;
                }
            });
        }
        
        // Update the channel list
        if (channelsHTML) {
            channelList.innerHTML = channelsHTML;
            
            // Add click handlers
            const channelItems = channelList.querySelectorAll('.kavita-channel-item');
            channelItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    const channelId = item.getAttribute('data-channel-id');
                    if (channelId) {
                        openChannelModal(channelId);
                    }
                });
            });
        } else {
            // No channels loaded, show message
            channelList.innerHTML = `
                <div class="kavita-channel-placeholder-note">
                    No channels found - check your configuration
                </div>
            `;
        }
        
        LoadingIndicator.endLoading('kavitaChannels');
        console.log("Channel data loaded successfully");
    } catch (error) {
        console.error("Error loading channel data:", error);
        LoadingIndicator.endLoading('kavitaChannels');
        
        // Fall back to placeholder data
        loadPlaceholderChannelData();
    }
}

// Helper function to fetch info for a single channel
async function fetchChannelInfo(channel) {
    try {
        // Check if we have the API key
        if (!channelFeedConfig.apiKey) {
            console.warn(`No YouTube API key available for channel ${channel.id}, using placeholder data`);
            return {
                success: true,
                html: getPlaceholderChannelHTML(channel)
            };
        }
        
        // Fetch channel data from YouTube API
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channel.id}&key=${channelFeedConfig.apiKey}`
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch channel data: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const channelData = data.items[0];
            const snippet = channelData.snippet;
            const statistics = channelData.statistics;
            
            // Update channel object with real data
            channel.name = channel.name || snippet.title;
            channel.description = snippet.description;
            channel.thumbnail = snippet.thumbnails.medium.url; // Using medium thumbnail
            channel.subscribers = parseInt(statistics.subscriberCount, 10);
            channel.videoCount = parseInt(statistics.videoCount, 10);
            
            // Generate HTML for this channel
            const html = `
                <div class="kavita-channel-item" data-channel-id="${channel.id}">
                    <div class="kavita-channel-thumbnail">
                        <img src="${channel.thumbnail}" alt="${channel.name}">
                    </div>
                    <div class="kavita-channel-name">${channel.name}</div>
                </div>
            `;
            
            return {
                success: true,
                html
            };
        } else {
            // Channel not found, use placeholder
            console.warn(`Channel ${channel.id} not found, using placeholder`);
            return {
                success: true,
                html: getPlaceholderChannelHTML(channel)
            };
        }
    } catch (error) {
        console.error(`Error fetching data for channel ${channel.id}:`, error);
        
        // Return placeholder HTML for this channel
        return {
            success: true,
            html: getPlaceholderChannelHTML(channel)
        };
    }
}

// Helper to generate placeholder HTML for a channel
function getPlaceholderChannelHTML(channel) {
    // Use channel.name if available, otherwise use a generic name based on ID
    const name = channel.name || `Channel ${channel.id.substring(0, 6)}`;
    const thumbnail = channel.thumbnail || `https://placehold.co/100x100/333/666?text=${encodeURIComponent(name)}`;
    
    return `
        <div class="kavita-channel-item" data-channel-id="${channel.id}">
            <div class="kavita-channel-thumbnail">
                <img src="${thumbnail}" alt="${name}" 
                    onerror="this.src='https://placehold.co/100x100/333/666?text=${encodeURIComponent(name)}'">
            </div>
            <div class="kavita-channel-name">${name}</div>
        </div>
    `;
}

// Load placeholder channel data
function loadPlaceholderChannelData() {
    const channelList = document.querySelector('.kavita-channel-list');
    if (!channelList) return;
    
    // Build HTML for placeholder channels
    let channelsHTML = '';
    
    // Use configured channels if available, otherwise use fallback
    const channelsToDisplay = channelFeedConfig.channels.length > 0 
        ? channelFeedConfig.channels 
        : [
            {
                id: 'UCLE0YuDRMprbHMfbvJYZpMw',
                name: 'Raph Retro Comics'
            },
            {
                id: 'UCDOkxRiVpdv6bYqrSa4TZlA',
                name: 'Dope Comix'
            }
        ];
    
    channelsToDisplay.forEach(channel => {
        channelsHTML += getPlaceholderChannelHTML(channel);
    });
    
    // Add placeholder indication
    channelsHTML += `
        <div class="kavita-channel-placeholder-note">
            Using placeholder data - YouTube API key unavailable
        </div>
    `;
    
    // Update the channel list
    channelList.innerHTML = channelsHTML;
    
    // Add click handlers
    const channelItems = channelList.querySelectorAll('.kavita-channel-item');
    channelItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const channelId = item.getAttribute('data-channel-id');
            if (channelId) {
                openChannelModal(channelId);
            }
        });
    });
    
    console.log("Placeholder channel data loaded");
}

// Open channel modal with channel content
async function openChannelModal(channelId) {
    console.log(`Opening channel modal for ${channelId}`);
    
    // Get modal element
    const modal = document.getElementById(channelFeedConfig.modalId);
    if (!modal) return;
    
    // Show loading state
    modal.querySelector('.kavita-modal-body').innerHTML = `
        <div class="kavita-channel-loading">
            <div class="loading-spinner"></div>
            <div>Loading channel content...</div>
        </div>
    `;
    
    // Show the modal with fade in
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('visible');
    }, 10);
    
    try {
        // Find the channel in our config
        const channel = channelFeedConfig.channels.find(c => c.id === channelId);
        
        if (!channel) {
            throw new Error(`Channel ${channelId} not found in config`);
        }
        
        // Get fresh channel data and videos if API key is available
        let channelData = channel;
        let latestVideos = [];
        
        if (channelFeedConfig.apiKey) {
            try {
                // Fetch channel data
                const channelResponse = await fetch(
                    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${channelFeedConfig.apiKey}`
                );
                
                if (!channelResponse.ok) {
                    throw new Error(`Failed to fetch channel data: ${channelResponse.status}`);
                }
                
                const channelResult = await channelResponse.json();
                
                if (channelResult.items && channelResult.items.length > 0) {
                    const item = channelResult.items[0];
                    
                    channelData = {
                        id: channelId,
                        name: channel.name || item.snippet.title,
                        description: item.snippet.description,
                        thumbnail: item.snippet.thumbnails.medium.url,
                        subscribers: parseInt(item.statistics.subscriberCount, 10),
                        videoCount: parseInt(item.statistics.videoCount, 10)
                    };
                }
                
                // Fetch latest videos
                const videosResponse = await fetch(
                    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${channelFeedConfig.maxResults || 5}&order=date&type=video&key=${channelFeedConfig.apiKey}`
                );
                
                if (!videosResponse.ok) {
                    throw new Error(`Failed to fetch videos: ${videosResponse.status}`);
                }
                
                const videosResult = await videosResponse.json();
                
                if (videosResult.items) {
                    latestVideos = videosResult.items.map(item => ({
                        id: item.id.videoId,
                        title: item.snippet.title,
                        description: item.snippet.description,
                        thumbnail: item.snippet.thumbnails.medium.url,
                        publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString()
                    }));
                }
            } catch (apiError) {
                console.error("Error fetching fresh channel data:", apiError);
                // Continue with the data we have
            }
        }
        
        // Format subscriber count
        const formattedSubscribers = channelData.subscribers 
            ? new Intl.NumberFormat().format(channelData.subscribers)
            : 'N/A';
        
        // Format video count
        const formattedVideoCount = channelData.videoCount
            ? new Intl.NumberFormat().format(channelData.videoCount)
            : 'N/A';
        
        // Update modal title
        modal.querySelector('.kavita-modal-title').textContent = channelData.name || `Channel ${channelId}`;
        
        // Prepare videos HTML
        let videosHTML = '';
        
        if (latestVideos.length > 0) {
            // We have videos to show
            videosHTML = `
                <div class="kavita-videos-header">Latest Videos</div>
                <div class="kavita-videos-grid">
            `;
            
            latestVideos.forEach(video => {
                videosHTML += `
                    <div class="kavita-video-item" data-video-id="${video.id}">
                        <div class="kavita-video-thumbnail">
                            <img src="${video.thumbnail}" alt="${video.title}">
                        </div>
                        <div class="kavita-video-info">
                            <div class="kavita-video-title">${video.title}</div>
                            <div class="kavita-video-date">${video.publishedAt}</div>
                        </div>
                    </div>
                `;
            });
            
            videosHTML += '</div>';
        } else if (channelFeedConfig.fallbackVideos && channelFeedConfig.fallbackVideos.length > 0) {
            // Use fallback videos
            videosHTML = `
                <div class="kavita-videos-header">
                    Sample Videos (API key needed for channel videos)
                </div>
                <div class="kavita-videos-grid">
            `;
            
            channelFeedConfig.fallbackVideos.forEach(video => {
                videosHTML += `
                    <div class="kavita-video-item" data-video-id="${video.id}">
                        <div class="kavita-video-thumbnail">
                            <img src="https://img.youtube.com/vi/${video.id}/mqdefault.jpg" alt="${video.title}">
                        </div>
                        <div class="kavita-video-info">
                            <div class="kavita-video-title">${video.title}</div>
                            <div class="kavita-video-date">Sample</div>
                        </div>
                    </div>
                `;
            });
            
            videosHTML += '</div>';
        } else {
            // No videos and no fallbacks
            videosHTML = `
                <div class="kavita-videos-header">
                    ${channelFeedConfig.apiKey ? 'No videos found' : 'Videos unavailable - API key needed'}
                </div>
            `;
        }
        
        // Main video container - show first video if available
        const videoToShow = latestVideos.length > 0 ? latestVideos[0] : 
                          (channelFeedConfig.fallbackVideos && channelFeedConfig.fallbackVideos.length > 0 ? 
                           { id: channelFeedConfig.fallbackVideos[0].id } : null);
        
        const mainVideoHTML = videoToShow ? `
            <div class="kavita-video-container">
                <iframe 
                    width="100%" 
                    height="100%" 
                    src="https://www.youtube.com/embed/${videoToShow.id}" 
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen
                ></iframe>
            </div>
        ` : `
            <div class="kavita-video-container empty">
                <div class="kavita-empty-player">
                    <div class="kavita-empty-player-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polygon points="10 8 16 12 10 16 10 8"></polygon>
                        </svg>
                    </div>
                    <div>No videos available</div>
                </div>
            </div>
        `;
        
        // Build the complete modal content
        const modalContent = `
            <div class="kavita-channel-info">
                <div class="kavita-channel-thumbnail">
                    <img src="${channelData.thumbnail || `https://placehold.co/100x100/333/666?text=${encodeURIComponent(channelData.name || 'Channel')}`}"
                        alt="${channelData.name || 'Channel'}"
                        onerror="this.src='https://placehold.co/100x100/333/666?text=${encodeURIComponent(channelData.name || 'Channel')}'">
                </div>
                <div class="kavita-channel-details">
                    <div class="kavita-channel-description">${channelData.description ? (channelData.description.substring(0, 200) + (channelData.description.length > 200 ? '...' : '')) : 'No description available'}</div>
                    <div class="kavita-channel-stats">
                        <div class="kavita-channel-subscribers">Subscribers: ${formattedSubscribers}</div>
                        <div class="kavita-channel-videos">Videos: ${formattedVideoCount}</div>
                        <a href="https://www.youtube.com/channel/${channelId}" target="_blank" rel="noopener noreferrer" class="kavita-channel-link">
                            Visit Channel
                        </a>
                    </div>
                </div>
            </div>
            <div class="kavita-video-player">
                ${mainVideoHTML}
            </div>
            <div class="kavita-channel-videos-list">
                ${videosHTML}
            </div>
        `;
        
        // Update modal body
        modal.querySelector('.kavita-modal-body').innerHTML = modalContent;
        
        // Add click handlers for videos
        const videoItems = modal.querySelectorAll('.kavita-video-item');
        videoItems.forEach(item => {
            item.addEventListener('click', () => {
                const videoId = item.getAttribute('data-video-id');
                if (videoId) {
                    // Update the video player
                    const videoContainer = modal.querySelector('.kavita-video-container');
                    if (videoContainer) {
                        videoContainer.innerHTML = `
                            <iframe 
                                width="100%" 
                                height="100%" 
                                src="https://www.youtube.com/embed/${videoId}" 
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowfullscreen
                            ></iframe>
                        `;
                        
                        // Scroll to player
                        videoContainer.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });
    } catch (error) {
        console.error("Error opening channel modal:", error);
        
        // Show error message in modal
        modal.querySelector('.kavita-modal-body').innerHTML = `
            <div class="kavita-error-message">
                <div>Error loading channel content</div>
                <div class="kavita-error-details">${error.message}</div>
            </div>
        `;
    }
}

// Close the channel modal
function closeChannelModal() {
    const modal = document.getElementById(channelFeedConfig.modalId);
    if (!modal) return;
    
    // Remove visible class to start animation
    modal.classList.remove('visible');
    
    // Hide after animation completes
    setTimeout(() => {
        modal.style.display = 'none';
        
        // Stop any playing videos
        const iframes = modal.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            // Reset the src to stop playback
            const src = iframe.src;
            iframe.src = '';
            iframe.src = src;
        });
    }, channelFeedConfig.animationDuration);
    
    console.log("Closing channel modal");
}

// Initialize on import
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize the module
        initializeChannelFeed();
        
        // Add styles
        addChannelFeedStyles();
    });
}

// Add required styles to the document
function addChannelFeedStyles() {
    // Check if styles already exist
    if (document.getElementById('kavita-channel-feed-styles')) {
        return;
    }
    
    // Create a link element to load the external CSS file
    const linkElement = document.createElement('link');
    linkElement.id = 'kavita-channel-feed-styles';
    linkElement.rel = 'stylesheet';
    linkElement.href = 'css/kavita-channel-feed.css'; // Path to the CSS file
    
    // Add to document head
    document.head.appendChild(linkElement);
    console.log("Added Kavita channel feed styles");
}

// Export the module functions
export {
    showChannelFeed,
    hideChannelFeed,
    openChannelModal,
    closeChannelModal
}