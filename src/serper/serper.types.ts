export type WebSearchParameters = {
  query: string;
  viewFrom?: 'United States' | 'France';
  language?: 'en' | 'fr' | 'es';
  period?: 'last_hour' | 'last_day' | 'last_week' | 'last_month' | 'last_year';
};

export type NewsSearchParameters = {
  query: string;
  viewFrom?: 'United States' | 'France';
  language?: 'en' | 'fr' | 'es';
  period?: 'last_hour' | 'last_day' | 'last_week' | 'last_month' | 'last_year';
};

export type ReviewSearchParameters = {
  placeId: string;
  language: string;
};

export type WebSearchResult = {
  title: string;
  link: string;
  snippet: string;
};

export type NewsSearchResult = {
  title: string;
  link: string;
  snippet: string;
};

export type ReviewSearchResult = {
  rating: number;
  isoDate: string;
  snippet: string;
};

// ----------------------------------------------------
// Core Interfaces for Search Results
// ----------------------------------------------------

// Represents a single organic search result
export interface OrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  sitelinks?: Sitelink[];
  attributes?: { [key: string]: string | string[] };
  date?: string;
}

// Represents a link within a search result
export interface Sitelink {
  title: string;
  link: string;
}

// Represents a question/answer box
export interface PeopleAlsoAsk {
  question: string;
  snippet: string;
  title: string;
  link: string;
}

export interface NewsResult {
  title: string;
  link: string;
  date: string;
  source: string;
  position: number;
  section?: string;
  snippet?: string;
  imageUrl?: string;
}

// Represents a related search query
export interface RelatedSearch {
  query: string;
}

// ----------------------------------------------------
// Knowledge Graph Interfaces
// ----------------------------------------------------

// Represents the attributes within the knowledge graph
export interface KnowledgeGraphAttributes {
  [key: string]: string | string[];
}

// Represents the entire knowledge graph object
export interface KnowledgeGraph {
  title: string;
  type: string;
  website: string;
  imageUrl: string;
  description: string;
  descriptionSource: string;
  descriptionLink: string;
  attributes: KnowledgeGraphAttributes;
}

// ----------------------------------------------------
// Search Parameters Interface
// ----------------------------------------------------

// Represents the parameters used for the search
export interface SearchParameters {
  q: string;
  gl: string;
  hl: string;
  autocorrect: boolean;
  page: number;
  type: string;
}

/**
 * Represents a single media item associated with a review.
 */
export interface ReviewMedia {
  type: 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
}

/**
 * Represents the user who wrote the review.
 */
export interface ReviewUser {
  name: string;
  thumbnail: string;
  link: string;
  reviews: number;
  photos: number;
}

/**
 * Represents a response to a review, typically from the business owner.
 */
export interface ReviewResponse {
  date: string;
  isoDate: string;
  snippet: string;
}

/**
 * Represents a single customer review.
 */
export interface Review {
  rating: number; // The star rating (e.g., 5, 4)
  date: string; // Human-readable date of the review (e.g., "il y a 4 mois")
  isoDate: string; // ISO 8601 formatted date of the review
  snippet: string; // The main text content of the review
  likes: number | null; // Number of likes on the review, can be null
  user: ReviewUser; // Information about the user who wrote the review
  media?: ReviewMedia[]; // Optional: Array of media items associated with the review
  response?: ReviewResponse; // Optional: Response to the review
  id: string; // Unique ID of the review
}

// ----------------------------------------------------
// Main Response Interface
// ----------------------------------------------------

/**
 * The main interface for the entire Serper.dev API response.
 * This combines all the sub-interfaces to provide a complete type definition.
 */
export interface SerperResponse {
  searchParameters: SearchParameters;
  knowledgeGraph?: KnowledgeGraph; // Optional as it may not always be present
  organic: OrganicResult[];
  peopleAlsoAsk?: PeopleAlsoAsk[]; // Optional
  relatedSearches?: RelatedSearch[]; // Optional
  news?: NewsResult[]; // Optional
  reviews?: Review[]; // Optional
}
