export interface StreamedMatch {
    slug: string;
    title: string;
    date: string;
    sources: StreamedSource[];
    poster: string;
}

export interface StreamedSource {
    source: string;
    id: string;
    label?: string;
    quality?: string;
}

export interface StreamedLiveEvent {
    title: string;
    poster: string;
    sport: string;
    date: string;
    slug: string;
    sources: any[];
}

const BASE_URL = 'https://streamed.pk/api';

export const StreamedAPI = {
    async getAllMatches(): Promise<StreamedMatch[]> {
        try {
            const response = await fetch(`${BASE_URL}/matches/all`);
            if (!response.ok) throw new Error('Failed to fetch matches');
            return await response.json();
        } catch (error) {
            console.error('StreamedAPI Error:', error);
            return [];
        }
    },

    async getLiveMatches(): Promise<StreamedLiveEvent[]> {
        try {
            const response = await fetch(`${BASE_URL}/matches/live`);
            if (!response.ok) throw new Error('Failed to fetch live matches');
            return await response.json();
        } catch (error) {
            console.error('StreamedAPI Error:', error);
            return [];
        }
    },

    async getSportMatches(sport: string): Promise<StreamedMatch[]> {
        try {
            const response = await fetch(`${BASE_URL}/matches/sport/${sport}`);
            if (!response.ok) throw new Error(`Failed to fetch ${sport} matches`);
            return await response.json();
        } catch (error) {
            console.error('StreamedAPI Error:', error);
            return [];
        }
    },

    async getMatchStream(matchId: string): Promise<any> {
        // Logic to get stream URL if needed, often embedded or passed directly
        // This might depend on how the API structure actually returns stream info.
        // Based on docs, matches endpoint might return sources directly.
        return null;
    }
};
