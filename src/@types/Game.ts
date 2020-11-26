import { Moment } from 'moment'

export interface Game {
  // url: string
  // types: string
  // name: string
  // desc_snippet: string
  // recent_reviews: string
  // all_reviews: string
  // release_date: string
  // developer: string
  // publisher: string
  // popular_tags: string
  // game_details: string
  // languages: string
  // achievements: string
  // genre: string
  // game_description: string
  // mature_content: string
  // minimum_requirements: string
  // recommended_requirements: string
  // original_price: number
  // discount_price: number

  url: string // url
  type: 'app' | 'bundle' | 'sub' | null // type / possible ''
  name: string // name
  description: string // game_description
  shortDescription: string | null // desc_snippet / possible NaN, ''
  languages: string[] // languages split ,
  genres: string[] // genre split ,
  tags: string[] // popular_tags split ,
  features: string[] // game_details split ,
  releaseDate: Moment | null // release_date / possible NaN, ''
  developers: string[] // developer split ,
  publishers: string[] // publisher split ,
  satisfaction: number // extract % from all_reviews / 'Very Positive,(280),- 97% of the 280 user reviews for this game are positive.'
  price: number | null // priority discount_price -> original_price / possible NaN, '' / Must handle Free words
}
