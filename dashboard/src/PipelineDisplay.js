import React, { Component } from 'react';
import { Card, List, Icon, Accordion, Progress } from 'semantic-ui-react';
import moment from 'moment';

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
        <Accordion.Title as='h2' index={i} active={activeIndex === i} onClick={this.handleClick}>
          <Icon name='dropdown'/>
          {task.call}
          <br/>
          <List horizontal>
            { task.args.map((arg, i) => <List.Item key={i}>{arg}</List.Item>)}
          </List>
          {task.start !== undefined && <div>Started {moment(task.start).fromNow()}</div>}
          {task.start !== undefined && task.end === undefined &&
              <div>ETA: {moment.duration(
                (moment() - moment(task.start)) * ((1-task.progress)/task.progress)
              ).humanize()}</div>}
          {task.end !== undefined && <div>Ended {moment(task.end).fromNow()}</div>}
          <Progress
            autoSuccess
            percent={100*task.progress}
            active={task.error === undefined && task.active}
            error={task.error !== undefined}>
            {task.error !== undefined && task.error }
          </Progress>
        </Accordion.Title>
        <Accordion.Content active={activeIndex === i}>
          { task.result && <div>
            Results:
            <List>
              { task.result.map((hash, i) => <List.Item key={i}>
                <a href={`http://ipfs.io/ipfs/${hash}`}>{hash}</a>
              </List.Item>) }
            </List>
          </div> }
        </Accordion.Content>
      </div>
    );

    return (
      <Card>
        <Card.Content header={`Pipeline ${pipeline.id}`}/>
        <Card.Content>
          <Accordion fluid>
            {steps}
          </Accordion>
        </Card.Content>
      </Card>
    );
  }
}

export default PipelineDisplay;
