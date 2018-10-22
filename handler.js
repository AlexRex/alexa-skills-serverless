const Alexa = require('ask-sdk-core');
const fetch = require('node-fetch');
const { defaultHandlers, ErrorHandler } = require('./defaultHandlers');

const { Task } = require('funfun/types/Task');

const response = handlerInput => speech => handlerInput.responseBuilder.speak(speech).reprompt(speech).getResponse();
const lastWeightURI = 'https://pharmatastic.herokuapp.com/user/lasthealth';

const getMyHealth = (handlerInput) => {
  const successSpeech = ({ weight = 80, pulse = 90, bloodLow, bloodHigh }) => (bloodLow && bloodHigh)
    ? `Your weight is ${Math.floor(weight)} kilograms and ${(weight % 1).toFixed(3) * 1000} grams, your last recorded pulse is ${pulse} BPM. Also your blood pressure ranges from ${bloodLow} to ${bloodHigh}.`
    : `Your weight is ${Math.floor(weight)} kilograms and ${(weight % 1).toFixed(3) * 1000} grams, your last recorded pulse is ${pulse} BPM.`
  const errorSpeech = `We got some crazy error`;
  const buildResponse = response(handlerInput);

  const keys = {
    weight: 'Weight (kg)',
    pulse: 'Heart Pulse (bpm) - only for BPM devices',
    bloodLow: 'Diastolic Blood Pressure (mmHg)',
    bloodHigh: 'Systolic Blood Pressure (mmHg)'
  }

  return Task.fromPromise(fetch(lastWeightURI))
    .chain(res => Task.fromPromise(res.json()))
    .map(res => Object.keys(keys).reduce((accum, key) => ({ ...accum, [key]: res[keys[key]] }), {}))
    .map(successSpeech)
    .toPromise()
    .then(buildResponse)
    .catch(e => buildResponse(errorSpeech));
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle: getMyHealth
};

const LastHealthRecords = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === process.env.HEALTH_INTENT;
  },
  handle: getMyHealth
}

const IAteHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === process.env.FOOD_INTENT;
  },
  handle(handlerInput) {
    const { when: { value: when }, food: { value: food }, exercise: { value: exercise = 'walk' } } = handlerInput.requestEnvelope.request.intent.slots;
    console.log(when, food, exercise);
    // const when = whenObject && whenObject.value;
    // const food = foodObject && foodObject.value;
    // const exercise = exerciseObject && (exerciseObject.value || 'walk');

    const successSpeech = ({ exerciseTime, f, e, w }) => w
      ? `As you had ${f} on ${w}, you have to ${e} for ${exerciseTime} minutes`
      : `As you had ${f}, you have to ${e} for ${exerciseTime} minutes`;
    const exerciseURI = (food, exercise) => `https://pharmatastic.herokuapp.com/food?food=${food}&exercise=${exercise}`;
  
    const errorSpeech = 'We got some crazy error';
    const buildResponse = response(handlerInput);

    if (!food) {
      return buildResponse('I dont know for this food');
    }

    return Task.fromPromise(fetch(exerciseURI(food, exercise)))
      .chain(res => Task.fromPromise(res.json()))
      .chain(res => Task((reject, resolve) => res.duration_min ? resolve(res.duration_min) : reject('I dont know for this food')))
      .map(d => Math.round(d))
      .map(exerciseTime => successSpeech({ exerciseTime, f: food, e: exercise, w: when }))
      .map(e => {
        console.log(e);
        return e;
      })
      .toPromise()
      .then(buildResponse)
      .catch(e => {
        console.log(e);
        buildResponse(errorSpeech);
      });
  }
}

// export the handlers
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    ...defaultHandlers,
    LaunchRequestHandler,
    LastHealthRecords,
    IAteHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
