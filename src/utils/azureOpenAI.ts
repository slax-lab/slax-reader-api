import { AzureOpenAI } from 'openai'
import { ContextManager } from './context'

interface AzureEndpoint {
  countries: string[]
  continents: string[]
  azureArea: string
  azureModel: string
  apiVersion: string
  apiKey: (env: Env) => string
}

// 默认端点设置为美西，因为它是唯一的美国端点，也作为其他地区的默认选项
const DEFAULT_ENDPOINT: AzureEndpoint = {
  countries: ['US'],
  continents: ['NA'],
  azureModel: 'gpt-4o',
  apiVersion: '2024-09-01-preview',
  azureArea: 'slax-common-openai-eastus2',
  apiKey: (env: Env) => env.AZURE_OPENAI_EASTUS2_KEY
}

// TODO 需要补充其他地区的覆盖范围
// - 美国东部：覆盖美国东部
// - 荷兰：覆盖欧洲大部
// - 英国：覆盖欧洲大部
// - 澳大利亚东部：覆盖澳大利亚 / 大洋洲
// - 巴西南部：覆盖南美洲大部
const AZURE_ENDPOINTS: AzureEndpoint[] = [
  DEFAULT_ENDPOINT,
  {
    // 日本(Japan East): 覆盖日本及其周边地区(如台湾、菲律宾)
    countries: ['JP', 'CN', 'HK', 'TW', 'PH'],
    continents: ['AS'],
    azureArea: 'slax-common-openai-japan-east',
    azureModel: 'gpt-4o',
    apiVersion: '2024-09-01-preview',
    apiKey: (env: Env) => env.AZURE_OPENAI_JAPAN_EAST_KEY
  },
  {
    // 韩国(Korea Central): 覆盖韩国及其他东亚和东南亚国家
    countries: ['KR', 'SG', 'ID', 'MY', 'TH', 'VN'],
    continents: ['AS'],
    azureArea: 'slax-common-openai-korea-central',
    azureModel: 'gpt-4o',
    apiVersion: '2024-09-01-preview',
    apiKey: (env: Env) => env.AZURE_OPENAI_KOREA_CENTRAL_KEY
  }
]

export function getBestAzureInstance(ctx: ContextManager): AzureOpenAI | null {
  const country = ctx.get('country') || ''
  const continent = ctx.get('continent') || ''
  const point = getEndpoint(ctx.env, country, continent)
  console.log(`[AzureOpenAI] Source ${country} ${continent}, Using Azure endpoint: ${point.azureArea}/${point.azureModel}`)
  if (!point.apiKey) return null
  return new AzureOpenAI({
    endpoint: `https://${point.azureArea}.openai.azure.com`,
    apiKey: point.apiKey(ctx.env),
    apiVersion: point.apiVersion,
    deployment: point.azureModel
  })
}

function getEndpoint(env: Env, country: string, continent: string): AzureEndpoint {
  console.log(country, continent, 'country, continent')
  // 精确匹配国家
  const countryMatch = AZURE_ENDPOINTS.find(endpoint => endpoint.countries.includes(country))
  if (countryMatch) return countryMatch

  // 匹配大洲
  const continentMatch = AZURE_ENDPOINTS.find(endpoint => endpoint.continents.includes(continent))
  if (continentMatch) return continentMatch

  // 兜底返回 East US
  return DEFAULT_ENDPOINT
}
