import { TranscriptRow } from 'podverse-shared'
import { AppState, AppStateStatus, StyleSheet } from 'react-native'
import React from 'reactn'
import { translate } from '../lib/i18n'
import { PV } from '../resources'
import PVEventEmitter from '../services/eventEmitter'
import { getPlaybackSpeed, playerGetPosition, playerHandleSeekTo } from '../services/player'
import { PVSearchBar } from './PVSearchBar'
import { AutoScrollToggle, FlatList, PressableWithOpacity, ScrollView, TableSectionSelectors, Text, View } from './'

type Props = {
  isNowPlaying?: boolean
  navigation?: any
  parsedTranscript: TranscriptRow[]
  width?: number
}

type State = {
  activeTranscriptRowIndex: number | null
  autoScrollOn: boolean
  searchText: string
  searchResults: never[]
}

const getCellID = (item: TranscriptRow, index: number) => `transcript-cell-${index}`

export class MediaPlayerCarouselTranscripts extends React.PureComponent<Props, State> {
  currentSpeaker?: string
  interval: ReturnType<typeof setInterval> | null = null
  listRef: any | null = null
  appStateListenerChange: any

  constructor() {
    super()

    this.state = {
      activeTranscriptRowIndex: null,
      autoScrollOn: false,
      searchText: '',
      searchResults: []
    }
  }

  componentDidMount() {
    this.appStateListenerChange = AppState.addEventListener('change', this._handleAppStateChange)
    PVEventEmitter.on(PV.Events.PLAYER_SPEED_UPDATED, this.updateAutoscroll)
  }

  componentWillUnmount() {
    this.appStateListenerChange.remove()
    PVEventEmitter.removeListener(PV.Events.PLAYER_SPEED_UPDATED, this.updateAutoscroll)
    this.clearAutoScrollInterval()
  }

  _handleAppStateChange = (nextAppStateStatus: AppStateStatus) => {
    if (nextAppStateStatus === 'active') {
      this._handleFocus()
    } else if (nextAppStateStatus === 'background' || nextAppStateStatus === 'inactive') {
      this._handleBlur()
    }
  }

  _handleFocus = () => {
    const { autoScrollOn } = this.state
    if (autoScrollOn) {
      this.enableAutoscroll()
    }
  }

  _handleBlur = () => {
    this.disableAutoscroll()
  }

  disableAutoscroll = () => {
    if (this.interval) {
      this.setState(
        {
          activeTranscriptRowIndex: null,
          autoScrollOn: false
        },
        this.clearAutoScrollInterval
      )
    }
  }

  toggleAutoscroll = () => {
    if (this.interval) {
      this.setState(
        {
          activeTranscriptRowIndex: null,
          autoScrollOn: false
        },
        this.clearAutoScrollInterval
      )
    } else {
      this.enableAutoscroll()
    }
  }

  updateAutoscroll = () => {
    if (this.interval) {
      this.enableAutoscroll()
    }
  }

  setAutoScrollInterval = async () => {
    const playbackSpeed = await getPlaybackSpeed()
    const intervalTime = 500 / playbackSpeed
    return setInterval(() => {
      (async () => {
        const { parsedTranscript } = this.props
        if (parsedTranscript) {
          const currentPosition = await playerGetPosition()

          const index = parsedTranscript.findIndex(
            (item: Record<string, any>) => item.startTime < currentPosition && item.endTime > currentPosition
          )

          if (index !== -1) {
            const { parsedTranscript } = this.props
            const transcriptRow = parsedTranscript[index] || { positionY: 0 }
            const { positionY } = transcriptRow
            this.listRef.scrollToOffset({
              offset: positionY - PV.FlatList.transcriptRowHeights.autoScrollYOffset, animated: false })
            this.setState({ activeTranscriptRowIndex: index })
          }
        }
      })()
    }, intervalTime)
  }

  enableAutoscroll = async () => {
    this.clearAutoScrollInterval()
    this.setState({ autoScrollOn: true })
    this.interval = await this.setAutoScrollInterval()
  }

  clearAutoScrollInterval = () => {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  renderItem = ({ item, index }) => {
    const { isNowPlaying } = this.props
    const { activeTranscriptRowIndex } = this.state
    const transcriptionItem = item
    const { body, speaker, startTime, startTimeFormatted } = transcriptionItem
    const cellID = getCellID(transcriptionItem, index)

    if (speaker && speaker !== this.currentSpeaker) {
      this.currentSpeaker = speaker
    } else {
      this.currentSpeaker = ''
    }

    const activeTranscriptStyle =
      ((activeTranscriptRowIndex && activeTranscriptRowIndex >= 0) || activeTranscriptRowIndex === 0) &&
      activeTranscriptRowIndex === index
        ? { color: PV.Colors.orange }
        : {}

    const accessibilityLabel = `${this.currentSpeaker ? `${this.currentSpeaker}, ` : ''} ${body}, ${startTimeFormatted}`

    const disable = !isNowPlaying
    const onPress = isNowPlaying ? () => playerHandleSeekTo(startTime) : null

    return (
      <PressableWithOpacity
        accessible
        accessibilityLabel={accessibilityLabel}
        activeOpacity={0.7}
        disable={disable}
        onPress={onPress}>
        {!!this.currentSpeaker && (
          <Text isSecondary style={styles.speaker} testID={`${cellID}-${this.currentSpeaker}`}>
            {this.currentSpeaker}
          </Text>
        )}
        <View style={styles.row}>
          <Text style={[styles.text, activeTranscriptStyle]} testID={cellID}>
            {body}
          </Text>
          <Text style={[styles.startTime, activeTranscriptStyle]} testID={`${cellID}-${startTime}`}>
            {startTimeFormatted}
          </Text>
        </View>
      </PressableWithOpacity>
    )
  }

  renderSingleLineTranscript = (item: any) => {
    const transcriptionItem = item
    const { body } = transcriptionItem
    return (
      <View style={styles.singleLineWrapper}>
        <Text style={styles.singleLineText}>{body}</Text>
      </View>
    )
  }

  render() {
    const { isNowPlaying, width } = this.props
    let { parsedTranscript } = this.props
    const { autoScrollOn } = this.state
    const { screenReaderEnabled } = this.global

    if (this.state.searchText) {
      parsedTranscript = this.state.searchResults || []
    }

    const isSingleLineTranscript = parsedTranscript.length === 1
    const wrapperStyle = width ? { width } : { width: '100%' }

    return (
      <View style={[styles.view, wrapperStyle]}>
        <TableSectionSelectors
          customButtons={
            !screenReaderEnabled && !isSingleLineTranscript && isNowPlaying ? (
              <AutoScrollToggle autoScrollOn={autoScrollOn} toggleAutoscroll={this.toggleAutoscroll} />
            ) : null
          }
          disableFilter
          hideDropdown
          includePadding
          selectedFilterLabel={translate('Transcript')}
        />
        <PVSearchBar
          accessibilityHint={translate(
            'ARIA HINT - Type to show only the transcript text that includes this search term'
          )}
          accessibilityLabel={translate('Transcript search input')}
          containerStyle={{
            backgroundColor: PV.Colors.velvet,
            marginBottom: 10,
            marginHorizontal: 12
          }}
          handleClear={() => {
            this.setState({
              searchText: '',
              searchResults: []
            })
          }}
          onChangeText={(searchText: string) => {
            if (!searchText || searchText?.length === 0) {
              this.setState({
                searchText: '',
                searchResults: []
              })
            } else {
              const searchResults = parsedTranscript.filter((item: Record<string, any>) => {
                return item?.body?.toLowerCase().includes(searchText?.toLowerCase())
              })

              this.setState(
                {
                  searchText,
                  searchResults,
                  autoScrollOn: false
                },
                this.clearAutoScrollInterval
              )
            }
          }}
          testID='transcript_search_bar'
          value={this.state.searchText}
        />
        {isSingleLineTranscript && <ScrollView>{this.renderSingleLineTranscript(parsedTranscript[0])}</ScrollView>}
        {!isSingleLineTranscript && (
          <FlatList
            contentContainerStyle={styles.contentContainerStyle}
            data={parsedTranscript}
            dataTotalCount={parsedTranscript.length}
            getItemLayout={(_: any, index: number) => {
              const { parsedTranscript } = this.props
              const transcriptRow = parsedTranscript[index]

              if (transcriptRow) {
                return { length: transcriptRow.height, offset: transcriptRow.positionY, index }  
              }

              return { length: 54, offset: 54 * index, index }
            }}
            ItemSeparatorComponent={() => <></>}
            keyExtractor={(item: TranscriptRow, index: number) => getCellID(item, index)}
            listRef={(ref: any) => {
              this.listRef = ref
            }}
            onScrollBeginDrag={this.disableAutoscroll}
            renderItem={this.renderItem}
            testID='transcript-flat-list'
            transparent
          />
        )}
      </View>
    )
  }
}

const styles = StyleSheet.create({
  contentContainerStyle: {
    marginVertical: 16,
    paddingBottom: 48
  },
  header: {
    flexDirection: 'row',
    paddingBottom: 12
  },
  headerText: {
    flex: 0,
    fontSize: PV.Fonts.sizes.xxl,
    fontWeight: PV.Fonts.weights.bold,
    textAlign: 'center'
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 2
  },
  speaker: {
    fontSize: PV.Fonts.sizes.xl,
    fontWeight: PV.Fonts.weights.bold,
    paddingBottom: 6,
    paddingHorizontal: 12,
    paddingTop: 24,
    height: 54,
    color: PV.Colors.skyLight
  },
  singleLineText: {
    fontSize: PV.Fonts.sizes.xxl,
    lineHeight: PV.Fonts.sizes.xxl + 7,
    paddingHorizontal: 8
  },
  singleLineWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  startTime: {
    flex: 0,
    fontSize: PV.Fonts.sizes.xxl,
    fontVariant: ['tabular-nums'],
    paddingLeft: 16
  },
  text: {
    borderColor: 'white',
    borderRightWidth: 1,
    flex: 1,
    flexWrap: 'wrap',
    fontSize: PV.Fonts.sizes.xxl,
    lineHeight: PV.Fonts.sizes.xxl + 7,
  },
  view: {
    flex: 1
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: 12
  }
})
