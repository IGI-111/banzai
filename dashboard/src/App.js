import React, { Component } from 'react';
import { Card, Container } from 'semantic-ui-react';
import Websocket from 'react-websocket';
import PipelineDisplay from './PipelineDisplay';
import CreatePipeline from './CreatePipeline';
import './App.css';

export const HOST = 'localhost:4000';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      pipelines: [],
    }
  }

  updatePipelines = (message) => {
    const pipelines = JSON.parse(message);
    this.setState({ pipelines });
  }

  render() {
    const { pipelines } = this.state;
    const pipelineDisplays = pipelines.map(
      (pipeline, i) => <PipelineDisplay key={i} pipeline={pipeline}/>);
    return (
      <Container style={{ marginTop: '3em' }}>
        <CreatePipeline/>
        <Container style={{ marginTop: '4em'}}>
          <Websocket url={`ws://${HOST}/live/pipeline`} onMessage={this.updatePipelines}/>
          <Card.Group itemsPerRow={3}>
            {pipelineDisplays}
          </Card.Group>
        </Container>
      </Container>
    );
  }
}

export default App;
