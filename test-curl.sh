# after running "offline.sh"

REST_TYPE=$2
STAGE=$1

usage()
{
	echo "usage: `basename $0` <local|dev|test|prod> <get|post>"
}

if [[ $REST_TYPE == "" || $STAGE == "" ]]; then
	usage
	exit 1
fi

if [[ $STAGE == "local" ]]; then
	URL="http://localhost:3000/${REST_TYPE}-message"
elif [[ $STAGE == "dev" ]]; then
	URL="https://qp73w6y1hc.execute-api.us-east-1.amazonaws.com/dev/${REST_TYPE}-message"
else
	usage
	echo "$STAGE unsupported"
	exit 1
fi

if [[ $REST_TYPE == "post" ]]; then
	curl -X POST -H "Content-Type: application/json" -d @callbackQuery.json $URL 
elif [[ $REST_TYPE == "get" ]]; then
	curl -L $URL
else
	echo "bad <REST_TYPE>"
	exit 1
fi
