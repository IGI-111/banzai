import React, { Component } from 'react';
import { Segment, Icon, Accordion, Container, Progress } from 'semantic-ui-react';
import './App.css';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      pipelines: [],
    }
  }

  async componentDidMount(){
    const pipelines = await fetch('http://localhost:4000/pipeline').then(e => e.json());
    this.setState({ pipelines });
  }

  render() {
    const { pipelines } = this.state;
    const pipelineDisplays = pipelines.map(
      (pipeline, i) => <PipelineDisplay key={i} pipeline={pipeline}/>);
    return (
      <Container text style={{ marginTop: '4em'}}>
        {pipelineDisplays}
      </Container>
    );
  }
}

class PipelineDisplay extends Component {
  state = { activeIndex: -1 };

  handleClick = (e, titleProps) => {
    const { index } = titleProps
    const { activeIndex } = this.state
    const newIndex = activeIndex === index ? -1 : index
    this.setState({ activeIndex: newIndex })
  }

  render() {
    const { pipeline } = this.props;
    const { activeIndex } = this.state;
    const steps = pipeline.tasks.map((task, i) =>
      <div key={i}>
        <Accordion.Title index={i} active={activeIndex === i} onClick={this.handleClick}>
          <h2>
            <Icon name='dropdown'/>
            {task.call}
            <Progress autoSuccess percent={100*task.progress} active={task.active}/>
          </h2>
        </Accordion.Title>
        <Accordion.Content active={activeIndex === i}>
          Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod
          tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At
          vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren,
          no sea takimata sanctus est Lorem ipsum dolor sit amet.
        </Accordion.Content>
      </div>
    );

    return (
      <Segment>
        <h1>{pipeline.id}</h1>
        <Accordion fluid>
          {steps}
        </Accordion>
      </Segment>

    );
  }
}

export default App;
