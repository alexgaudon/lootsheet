tmux new-session -d -s lootsheet 'cd /Users/ag/code/lootsheet && make dev-backend' \; split-window -v 'cd /Users/ag/code/lootsheet && make dev-frontend' \; attach -t lootsheet
