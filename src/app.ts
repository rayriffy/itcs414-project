import axios, { AxiosError } from 'axios'
import converter from 'csvtojson'
import path from 'path'
import { TaskQueue } from 'cwait'
import moment from 'moment'
import chalk from 'chalk'
import { sampleSize } from 'lodash'

import { RawGame } from './@types/RawGame'
import { Game } from './@types/Game'
import { reporter } from './utils/reporter'

// spin instance up using doker
// docker run -p 9200:9200 -p 9300:9300 --name elastic -e "discovery.type=single-node" -v /home/rayriffy/elastic/config:/usr/share/elasticsearch/config -v /home/rayriffy/elastic/data:/usr/share/elasticsearch/data docker.elastic.co/elasticsearch/elasticsearch:7.10.0
const ELASTIC_HOST = "http://server.rayriffy.com:9200"
const INDEX_NAME = "game3"

const DEBUG = false

const parsePrice = (input: string): number => {
  const pricePattern = /([\d.]+)/
  const matchPrice = input.match(pricePattern)

  if (matchPrice === null) {
    return 0
  } else {
    return matchPrice[1] === '' ? 0 : Number(matchPrice[1])
  }
}

;(async () => {
  /**
   * Read raw data
   */
  const rawFile = path.join(__dirname, '../data/steam_games.csv')
  const transformedData: RawGame[] = await converter().fromFile(rawFile)

  const pickedData = DEBUG ? sampleSize(transformedData, 2) : transformedData

  if (DEBUG) {
    reporter.info('Raw data converted to Object')
    console.log(pickedData)
  }

  /**
   * Transform data
   */
  const games: Game[] = pickedData.map(data => {
    const satisfactionPattern = /(\d+)% of/
    const matchSatisfaction = data.all_reviews.match(satisfactionPattern)
 
    return {
      url: data.url,
      type: data.types === '' ? null : data.types as Game['type'],
      name: data.name,
      description: data.game_description,
      shortDescription: ['NaN', ''].includes(data.desc_snippet) ? null : data.desc_snippet,
      languages: data.languages.split(','),
      genres: data.genre.split(','),
      tags: data.popular_tags.split(','),
      features: data.game_details.split(','),
      releaseDate: ['NaN', ''].includes(data.desc_snippet) ? null : moment(data.release_date),
      developers: data.developer.split(','),
      publishers: data.publisher.split(','),
      satisfaction: matchSatisfaction === null ? 0 : Number(matchSatisfaction[1]),
      price: parsePrice(['NaN', ''].includes(data.discount_price) ? data.original_price : data.discount_price),
    }
  })

  if (DEBUG) {
    reporter.info('Transformed data')
    console.log(games)
  }

  /**
   * Destroy old index
   */
  try {
    // https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-delete-index.html
    await axios.delete(`${ELASTIC_HOST}/${INDEX_NAME}`)
    reporter.done('Index has been removed')
  } catch {
    reporter.fail('Unable to removed index, but this step is fail-safe!')
  }

  /**
   * Create index (https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-create-index.html)
   */
  await axios.put(`${ELASTIC_HOST}/${INDEX_NAME}`, {
    // define fields (https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping.html)
    // In Elasticsearch, there is no dedicated array data type. Any field can contain zero or more values by default!!!
    mappings: {
      properties: {
        url: {
          // url should not be searchable
          type: 'text',
          index: false,
        },
        type: {
          type: 'keyword'
        },
        name: {
          type: 'text'
        },
        description: {
          type: 'text'
        },
        shortDescription: {
          type: 'text'
        },
        languages: {
          type: 'keyword'
        },
        genres: {
          type: 'keyword'
        },
        tags: {
          type: 'keyword'
        },
        features: {
          type: 'keyword'
        },
        // format yyyy/MM/dd
        releaseDate: {
          type: 'date'
        },
        developers: {
          type: 'keyword'
        },
        publishers: {
          type: 'keyword'
        },
        satisfaction: {
          type: 'short'
        },
        price: {
          type: 'double'
        },
      },
    },
  })
  reporter.done('Index has been created')

  /**
   * Dump data
   */
  // create taskqueue to run async only 20 operation at a time (execute 70000 request at one time = your computer dead)
  // @ts-ignore
  const queue = new TaskQueue(Promise, 1)
  await Promise.all(
    games.map(
      queue.wrap<void, Game>(async game => {
        // index data (https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html)
        // _doc vs _create: _doc automatically generate document id
        try {
          reporter.info(`Pushing ${chalk.blue(game.name)}`)

          const payload = {
            ...game,
            releaseDate: game.releaseDate === null ? null : game.releaseDate.toISOString(),
          }

          if (DEBUG) {
            reporter.info('Payload')
            console.log(payload)
          }

          await axios.post(`${ELASTIC_HOST}/${INDEX_NAME}/_doc`, payload)
        } catch (e) {
          const error = e as AxiosError

          reporter.fail(`Failed to push ${chalk.red(game.name)}`)
          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.log(error.response.data);
          } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.log(error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.log('Error', error.message);
          }
        }
      })
    )
  )
})()
