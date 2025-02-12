FROM semtech/mu-javascript-template:feature-node-18
RUN apt update
RUN apt -y install curl