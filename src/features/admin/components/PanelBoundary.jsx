import React from 'react';

// Keeps one Overview panel from taking the whole page down if it throws while rendering
// (for example the Mapbox map when WebGL or the token is missing).
export default class PanelBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[LOOKit Admin] Panel failed to render:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
