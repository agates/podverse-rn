import axios from 'axios'
import { encode as btoa } from 'base-64'
import { Alert } from 'react-native'
import { getAppUserAgent } from '../lib/utility'
import { PV } from '../resources'
import PVEventEmitter from '../services/eventEmitter'
import { v4vDisconnectProvider } from '../state/actions/v4v/v4v'

export type PVRequest = {
  basicAuth?: {
    username?: string
    password?: string
  }
  endpoint?: string
  query?: any
  body?: any
  headers?: any
  method?: string
  opts?: any
  timeout?: any
  isAlby?: boolean
}

let hasShownAlbyUnauthorizedExpiredAlert = false

export const request = async (req: PVRequest, customUrl?: string) => {
  const {
    basicAuth = {},
    endpoint = '',
    query = {},
    headers = {},
    body,
    method = 'GET',
    opts = {},
    timeout = 30000,
    isAlby
  } = req

  const queryString = Object.keys(query)
    .map((key) => {
      return `${key}=${query[key]}`
    })
    .join('&')

  const userAgent = getAppUserAgent()
  const urlsApi = await PV.URLs.api()

  const url = customUrl ? customUrl : `${urlsApi.baseUrl}${endpoint}?${queryString}`

  const basicAuthHeader =
    basicAuth.username && basicAuth.password ? `Basic ${btoa(`${basicAuth.username}:${basicAuth.password}`)}` : ''

  const axiosRequest = {
    url,
    headers: {
      ...headers,
      'User-Agent': userAgent,
      ...(basicAuthHeader ? { Authorization: basicAuthHeader } : {})
    },
    ...(body ? { data: body } : {}),
    method,
    ...opts,
    timeout
  }

  try {
    const response = await axios(axiosRequest)

    return response
  } catch (error) {
    console.log('error message:', error.message)
    console.log('error response:', error.response)

    if (
      isAlby &&
      error?.response?.status === PV.ResponseErrorCodes.UNAUTHORIZED &&
      error?.response?.data?.error === 'expired access token'
    ) {
      await v4vDisconnectProvider(PV.V4V.providers.alby.key)
      
      if (!hasShownAlbyUnauthorizedExpiredAlert) {
        hasShownAlbyUnauthorizedExpiredAlert = true
        Alert.alert(
          PV.Alerts.ALBY_UNAUTHORIZED_EXPIRED.title,
          PV.Alerts.ALBY_UNAUTHORIZED_EXPIRED.message,
          PV.Alerts.BUTTONS.OK
        )
        setTimeout(() => {
          hasShownAlbyUnauthorizedExpiredAlert = false
        }, 60000)
      }
    } else if (
      error?.response?.status === PV.ResponseErrorCodes.SERVER_MAINTENANCE_MODE &&
      error.response.data?.isInMaintenanceMode
    ) {
      PVEventEmitter.emit(PV.Events.SERVER_MAINTENANCE_MODE)
      return
    } else if (error.response && error.response.code === PV.ResponseErrorCodes.PREMIUM_MEMBERSHIP_REQUIRED) {
      Alert.alert(
        PV.Alerts.PREMIUM_MEMBERSHIP_REQUIRED.title,
        PV.Alerts.PREMIUM_MEMBERSHIP_REQUIRED.message,
        PV.Alerts.BUTTONS.OK
      )
    } else if (!error.response) {
      // Alert.alert(PV.Alerts.SOMETHING_WENT_WRONG.title, PV.Alerts.SOMETHING_WENT_WRONG.message, [])
    }

    throw error
  }
}
