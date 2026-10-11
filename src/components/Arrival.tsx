export function Arrival({ onTop, onAirspace }: { onTop: () => void; onAirspace: () => void }) {
  return (
    <section id="arrival" className="arr" aria-labelledby="arr-title" data-scene-id="5">
      <div className="wrap arr__inner">
        <p className="eyebrow mono">Scene 05 — Arrival</p>
        <h2 id="arr-title" className="display arr__title">Cleared to land.</h2>
        <p className="lede">Every dot above was a real aircraft a moment ago. Pick another sky, or fly it again.</p>
        <div className="arr__cta">
          <button type="button" className="btn btn--solid" onClick={onAirspace}>Back to the airspace</button>
          <button type="button" className="btn" onClick={onTop}>Fly it again ↑</button>
        </div>
      </div>
      <div className="runway" aria-hidden="true" />
      <footer className="arr__foot mono">
        <span>
          Aircraft data from <a href="https://adsb.lol" target="_blank" rel="noreferrer noopener">ADSB.lol</a>
        </span>
        <span>Positions are unverified and not for navigation.</span>
      </footer>
    </section>
  )
}
