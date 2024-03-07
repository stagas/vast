import { Clock } from '../dsp/core/clock'
import { Player } from './player'
import { Out, PlayerTrack } from './player-shared'

export * from '../alloc'

export function createPlayer(sampleRate: u32): Player {
  return new Player(sampleRate)
}

export function getPlayerBars(player: Player): usize {
  return changetype<usize>(player.bars)
}

export function getPlayerNext(player: Player): usize {
  return changetype<usize>(player.next)
}

export function swapBars(player: Player): void {
  const curr = player.bars
  const next = player.next
  player.bars = next
  player.next = curr
}

export function getPlayerClock(player$: usize): usize {
  const player = changetype<Player>(player$)
  return changetype<usize>(player.clock)
}

export function resetClock(clock$: usize): void {
  const clock = changetype<Clock>(clock$)
  clock.reset()
}

export function updateClock(clock$: usize): void {
  const clock = changetype<Clock>(clock$)
  clock.update()
}

export function playerProcess(player$: usize, begin: u32, end: u32, out$: usize): void {
  const player = changetype<Player>(player$)
  player.process(begin, end, out$)
}

export function clearLastBar(player$: usize): void {
  const player = changetype<Player>(player$)
  player.last = null
}

export function createPlayerTrack(): usize {
  return changetype<usize>(new PlayerTrack())
}

export function createOut(): usize {
  return changetype<usize>(new Out())
}
