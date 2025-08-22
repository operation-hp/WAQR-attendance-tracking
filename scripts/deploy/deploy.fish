#!/usr/bin/env fish

# Define a function to check the last command's status
function check_status
    if test $status -ne 0
        echo "Error: Exiting script."
        exit 1
    end
end

export NODE_ENV="production"

nvm install
check_status
nvm use 
check_status
npm i
check_status
node src/app.js
check_status
