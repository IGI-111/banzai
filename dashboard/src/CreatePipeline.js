import React, { Component } from 'react';
import { Input, Button, Form, Step, Dropdown } from 'semantic-ui-react';
import update from 'react-addons-update';
import { HOST } from './App';


class CreatePipeline extends Component {
  state = {
    tasks: {
      'FETCH_FESTVOX': {
        args: [
          { label: 'URL', type: 'text' },
        ]
      },
      'FILTER_LONGER': {
        args: [
          { label: 'Length', type: 'number' },
        ]
      },
      'FILTER_SHORTER': {
        args: [
          { label: 'Length', type: 'number' },
        ]
      },
      'EXTRACT_MFCC': {
        args: [
          { label: 'FFT Size', type: 'number' },
          { label: 'Bank Count', type: 'number' },
          { label: 'Low Frequency', type: 'number' },
          { label: 'High Frequency', type: 'number' },
          { label: 'Sample Rate', type: 'number' },
        ]
      },
      'LEARN': {
        args: [
        ]
      },
    },
    loading: false,
    selection: [
      'FETCH_FESTVOX',
      'FILTER_LONGER',
      'EXTRACT_MFCC',
      'LEARN',
    ],
    arguments: [
      ["http://festvox.org/cmu_arctic/cmu_arctic/packed/cmu_us_awb_arctic-0.90-release.zip"],
      [5],
      [32, 24, 1, 8000, 16000],
      [],
    ],
  }

  createPipeline = async () => {
    const body = this.state.selection.map((call, i) => {
      const args = this.state.arguments[i];
      return { call, args };
    });
    this.setState({ loading: true });
    await fetch(`http://${HOST}/pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    this.setState({ loading: false });
  }

  render(){
    const steps = [
      [ 'FETCH_FESTVOX' ],
      [ 'FILTER_LONGER', 'FILTER_SHORTER' ],
      [ 'EXTRACT_MFCC' ],
      [ 'LEARN' ],
    ].map((options, i) =>
      <Step key={i}>
        <Step.Content>
          <Step.Title>
            <Dropdown selection
              value={this.state.selection[i]}
              onChange={(e, data) => this.setState(update(this.state, {
                selection: { $splice: [[i, 1, data.value]] },
                arguments: { $splice: [[i, 1, new Array(this.state.tasks[data.value].args.length)]] }
              }))}
              options={options.map(option => {
                return { key: option,  value: option, text: option};
              })}
            />
          </Step.Title>
          <Step.Description>
            {this.state.tasks[this.state.selection[i]].args.map((arg, j) => <Form.Field key={j}>
              <label>{arg.label}</label>
              <Input value={this.state.arguments[i][j]} type={arg.type}
                onChange={(e, data) => this.setState(update(this.state, {
                  arguments: {
                    $splice: [[i, 1,
                      update(this.state.arguments[i], { $splice: [[j, 1,
                        arg.type === 'number' ? Number(data.value) : data.value]] })
                    ]]
                  }
                }))}
              /><br/>
            </Form.Field>)}
          </Step.Description>
        </Step.Content>
      </Step>

    );

    return (
      <Form readOnly={this.state.loading}>
        <Step.Group>
          {steps}
        </Step.Group>
        <br/>
        <Button loading={this.state.loading} onClick={this.createPipeline}>Start</Button>
      </Form>
    );
  }
}

export default CreatePipeline;
